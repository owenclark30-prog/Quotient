"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOnboardingRuns, getRunProgress } from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import type { OnboardingRun } from "@/lib/supabase/types";
import { RequireAuth } from "../../components/RequireAuth";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OnboardingClientsPage() {
  return (
    <RequireAuth>
      <OnboardingClients />
    </RequireAuth>
  );
}

function OnboardingClients() {
  const [runs, setRuns] = useState<OnboardingRun[]>([]);
  const [progress, setProgress] = useState<
    Map<string, { done: number; total: number }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOnboardingRuns(), getRunProgress()])
      .then(([runsData, progressData]) => {
        setRuns(runsData);
        setProgress(progressData);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load clients")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Client onboarding</h1>
      <p className="subtitle">Everyone you&rsquo;re currently onboarding</p>

      {error && <div className="empty-state error-state">{error}</div>}

      {!error && runs.length === 0 && (
        <div className="empty-state">
          Nobody yet. Onboarding starts when you save a proposal for a tier that
          has documents or{" "}
          <Link href="/onboarding/processes">a process</Link> attached.
        </div>
      )}

      {runs.length > 0 && (
        <ul className="proposal-list">
          {runs.map((run) => {
            const counts = progress.get(run.id);
            const done = counts?.done ?? 0;
            const total = counts?.total ?? 0;
            const complete = total > 0 && done === total;
            return (
              <li key={run.id}>
                <Link
                  href={`/onboarding/clients/${run.id}`}
                  className="proposal-list-item"
                >
                  <div>
                    <div className="proposal-list-client">
                      {run.client_name}
                    </div>
                    <div className="proposal-list-tier">{run.tier_name}</div>
                  </div>
                  <div className="run-meta">
                    {total > 0 && (
                      <span
                        className={`run-progress${complete ? " complete" : ""}`}
                      >
                        {done}/{total}
                      </span>
                    )}
                    <span className="proposal-list-date">
                      {formatDate(run.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
