"use client";

import { useEffect, useState } from "react";
import { getAgencyIdentityOrDefault } from "@/lib/data/settings";
import {
  getCostSettingsOrDefault,
  type AgencyCostSettings,
} from "@/lib/data/cost-settings";
import { getTiers } from "@/lib/data/tiers";
import { errorMessage } from "@/lib/errors";
import type { AgencyIdentity, Tier } from "@/lib/supabase/types";
import { AgencySettings } from "../components/AgencySettings";
import { CostSettings } from "../components/CostSettings";
import { RequireAuth } from "../components/RequireAuth";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const [identity, setIdentity] = useState<AgencyIdentity | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [costSettings, setCostSettings] = useState<AgencyCostSettings | null>(
    null
  );
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [costWarning, setCostWarning] = useState<string | null>(null);

  useEffect(() => {
    getAgencyIdentityOrDefault().then((result) => {
      setIdentity(result.identity);
      setWarning(result.warning);
    });

    // Both before either is set: CostSettings seeds its draft from the tiers it
    // is mounted with, so handing it settings first and tiers second would show
    // every tier's hours as blank.
    async function loadCosts() {
      const [result, tierResult] = await Promise.all([
        getCostSettingsOrDefault(),
        getTiers().then(
          (data) => ({ tiers: data, warning: null }),
          (err) => ({
            tiers: [] as Tier[],
            warning: errorMessage(err, "Couldn't load your tiers"),
          })
        ),
      ]);

      setTiers(tierResult.tiers);
      setCostWarning(result.warning ?? tierResult.warning);
      setCostSettings(result.settings);
    }

    loadCosts();
  }, []);

  if (!identity) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Agency settings</h1>
      <p className="subtitle">
        What appears on your proposals, and what delivery costs you
      </p>

      {warning && (
        <div className="warning-banner">
          {warning} — showing the placeholder below. Saving will overwrite
          whatever is currently stored.
        </div>
      )}

      <AgencySettings value={identity} onSaved={setIdentity} />

      <hr className="divider" />

      <h2 className="section-title">Delivery costs</h2>
      <p className="section-intro">
        What it costs you to deliver. Used by &ldquo;Price this client&rdquo; to
        work out your floor — the lowest fee that still hits your margin. Never
        shown to a client.
      </p>

      {costWarning && (
        <div className="warning-banner">
          {costWarning} — showing the defaults below. Saving will overwrite
          whatever is currently stored.
        </div>
      )}

      {costSettings && (
        <CostSettings
          value={costSettings}
          tiers={tiers}
          onSaved={(settings, updatedTiers) => {
            setCostSettings(settings);
            setTiers(updatedTiers);
          }}
        />
      )}
    </main>
  );
}
