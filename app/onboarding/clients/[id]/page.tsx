"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  deleteOnboardingRun,
  getOnboardingRunById,
  getRunDocuments,
  getRunSteps,
  resyncRunFromTemplate,
  setStepCompleted,
} from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import type { OnboardingRun, OnboardingRunStep } from "@/lib/supabase/types";
import { formatDayOffset } from "../../../components/OnboardingStageEditor";
import { RequireAuth } from "../../../components/RequireAuth";

export default function OnboardingClientPage() {
  return (
    <RequireAuth>
      <OnboardingClient />
    </RequireAuth>
  );
}

function OnboardingClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [steps, setSteps] = useState<OnboardingRunStep[]>([]);
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const runData = await getOnboardingRunById(params.id);
    const [stepsData, documentsData] = await Promise.all([
      getRunSteps(runData.id),
      getRunDocuments(runData.id),
    ]);
    setRun(runData);
    setSteps(stepsData);
    setDocuments(documentsData);
  }, [params.id]);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err, "Failed to load this client")))
      .finally(() => setLoading(false));
  }, [load]);

  async function toggle(step: OnboardingRunStep) {
    setError(null);
    // Optimistic: a checklist that lags behind the tick feels broken.
    const completed = step.completed_at == null;
    setSteps((current) =>
      current.map((s) =>
        s.id === step.id
          ? { ...s, completed_at: completed ? new Date().toISOString() : null }
          : s
      )
    );
    try {
      await setStepCompleted(step.id, completed);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that tick."));
      await load();
    }
  }

  async function handleResync() {
    if (!run) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resyncRunFromTemplate(run.id, run.tier_id);
      await load();
      const parts = [
        result.added && `${result.added} added`,
        result.updated && `${result.updated} updated`,
        result.removed && `${result.removed} removed`,
      ].filter(Boolean);
      setNotice(
        parts.length === 0
          ? "Already up to date with your process."
          : `Re-synced: ${parts.join(", ")}. Completed steps were left alone.`
      );
    } catch (err) {
      setError(errorMessage(err, "Couldn't re-sync from the template."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOnboardingRun(run.id);
      router.push("/onboarding/clients");
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete this onboarding."));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (error && !run) {
    return (
      <main>
        <div className="empty-state">{error}</div>
      </main>
    );
  }

  if (!run) {
    return (
      <main>
        <div className="empty-state">Onboarding not found.</div>
      </main>
    );
  }

  const done = steps.filter((step) => step.completed_at).length;

  return (
    <main>
      <div className="proposal-actions">
        <Link href="/onboarding/clients" className="text-link">
          &larr; All clients
        </Link>
      </div>

      <h1>{run.client_name}</h1>
      <p className="subtitle">
        {run.tier_name}
        {steps.length > 0 && ` · ${done} of ${steps.length} done`}
      </p>

      {error && <div className="empty-state error-state">{error}</div>}
      {notice && <div className="warning-banner">{notice}</div>}

      <section>
        <label>Checklist</label>
        {steps.length === 0 ? (
          <div className="empty-state">
            No stages were attached when this started.{" "}
            {run.tier_id ? (
              <>
                Build a process on{" "}
                <Link href="/onboarding/processes">Processes</Link>, then
                re-sync below.
              </>
            ) : (
              "The tier this came from has since been deleted, so there's nothing to re-sync from."
            )}
          </div>
        ) : (
          <ul className="step-list">
            {steps.map((step) => (
              <li key={step.id}>
                <label
                  className={`step${step.completed_at ? " done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={step.completed_at != null}
                    onChange={() => toggle(step)}
                  />
                  <span className="step-body">
                    <span className="step-title">{step.title}</span>
                    {step.notes && (
                      <span className="step-notes">{step.notes}</span>
                    )}
                  </span>
                  {formatDayOffset(step.day_offset) && (
                    <span className="step-day">
                      {formatDayOffset(step.day_offset)}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {documents.length > 0 && (
        <section>
          <label>Documents sent</label>
          <ul className="proposal-list">
            {documents.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/onboarding/document/${document.id}`}
                  className="proposal-list-item"
                >
                  <div className="proposal-list-client">{document.name}</div>
                  <div className="proposal-list-date">View &rarr;</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <label>Process changed since this started?</label>
        <div className="run-footer-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handleResync}
            disabled={busy || !run.tier_id}
          >
            {busy ? "Working…" : "Re-sync from template"}
          </button>
          <button
            type="button"
            className="link-button danger"
            onClick={handleDelete}
            disabled={busy}
          >
            Delete this onboarding
          </button>
        </div>
        <p className="field-hint">
          Re-sync pulls in stages you&rsquo;ve added, edited or reordered since.
          Anything you&rsquo;ve already ticked is kept, even if that stage has
          left your process — it records work that actually happened. Only
          unticked steps that are no longer in the process are removed.
        </p>
      </section>
    </main>
  );
}
