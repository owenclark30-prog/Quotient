"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  createOnboardingStage,
  getOnboardingStages,
  updateOnboardingStage,
} from "@/lib/data/onboarding";
import { getTiers } from "@/lib/data/tiers";
import { errorMessage } from "@/lib/errors";
import type { OnboardingStage, Tier } from "@/lib/supabase/types";
import { OnboardingStageEditor } from "../../components/OnboardingStageEditor";
import { RequireAuth } from "../../components/RequireAuth";

export default function OnboardingProcessesPage() {
  return (
    <RequireAuth>
      <OnboardingProcesses />
    </RequireAuth>
  );
}

function OnboardingProcesses() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stages, setStages] = useState<OnboardingStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tiersData, stagesData] = await Promise.all([
      getTiers(),
      getOnboardingStages(),
    ]);
    setTiers(tiersData);
    setStages(stagesData);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err, "Failed to load processes")))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleAdd(tierId: string) {
    const title = (newTitles[tierId] ?? "").trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    try {
      const position = stages.filter((s) => s.tier_id === tierId).length;
      await createOnboardingStage(tierId, title, position);
      setNewTitles((current) => ({ ...current, [tierId]: "" }));
      await load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add that stage."));
    } finally {
      setBusy(false);
    }
  }

  /** Swaps two adjacent positions. Positions aren't unique, so this is two
   * plain updates rather than a dance around a constraint. */
  async function move(tierStages: OnboardingStage[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tierStages.length) return;
    setError(null);
    try {
      await Promise.all([
        updateOnboardingStage(tierStages[index].id, { position: target }),
        updateOnboardingStage(tierStages[target].id, { position: index }),
      ]);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't reorder those stages."));
    }
  }

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Onboarding processes</h1>
      <p className="subtitle">
        The stages a client goes through, built once per tier
      </p>

      {error && <div className="empty-state error-state">{error}</div>}

      {tiers.length === 0 ? (
        <div className="empty-state">
          No tiers yet. <Link href="/rate-card">Build your rate card</Link>{" "}
          first — a process belongs to a tier.
        </div>
      ) : (
        tiers.map((tier) => {
          const tierStages = stages.filter((s) => s.tier_id === tier.id);
          return (
            <section key={tier.id} className="tier-editor">
              <div className="tier-editor-header">
                <h2 className="section-title">{tier.name}</h2>
                <span className="field-hint">
                  {tierStages.length === 0
                    ? "No stages"
                    : `${tierStages.length} stage${tierStages.length === 1 ? "" : "s"}`}
                </span>
              </div>

              {tierStages.map((stage, index) => (
                <OnboardingStageEditor
                  key={stage.id}
                  stage={stage}
                  isFirst={index === 0}
                  isLast={index === tierStages.length - 1}
                  onMove={(direction) => move(tierStages, index, direction)}
                  onChanged={load}
                  onError={setError}
                />
              ))}

              <div className="editor-row editor-row-new">
                <input
                  type="text"
                  value={newTitles[tier.id] ?? ""}
                  placeholder="e.g. Send welcome pack"
                  onChange={(e) =>
                    setNewTitles((current) => ({
                      ...current,
                      [tier.id]: e.target.value,
                    }))
                  }
                  aria-label={`New stage for ${tier.name}`}
                />
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => handleAdd(tier.id)}
                  disabled={!(newTitles[tier.id] ?? "").trim() || busy}
                >
                  Add stage
                </button>
              </div>
            </section>
          );
        })
      )}

      <p className="field-hint">
        Day is relative to kickoff — 0 is kickoff day, 3 is three days after,
        -2 is two days before. Leave it blank if a stage isn&rsquo;t tied to a
        day. Changing a process here never alters a client already onboarding;
        pull changes in deliberately with &ldquo;Re-sync from template&rdquo;.
      </p>
    </main>
  );
}
