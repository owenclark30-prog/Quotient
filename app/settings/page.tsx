"use client";

import { useEffect, useState } from "react";
import { getAgencyNameOrDefault } from "@/lib/data/settings";
import { errorMessage } from "@/lib/errors";
import { AgencySettings } from "../components/AgencySettings";
import { RequireAuth } from "../components/RequireAuth";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const agency = await getAgencyNameOrDefault();
        setAgencyName(agency.agencyName);
        setWarning(agency.warning);
      } catch (err) {
        setError(errorMessage(err, "Failed to load settings"));
      } finally {
        setLoading(false);
      }
    }

    load();
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
      <h1>Agency settings</h1>
      <p className="subtitle">Details that appear on your proposals</p>

      {error && <div className="empty-state error-state">{error}</div>}

      {warning && (
        <div className="warning-banner">
          {warning} — showing the placeholder below. Saving will overwrite
          whatever name is currently stored.
        </div>
      )}

      <AgencySettings value={agencyName} onSaved={setAgencyName} />
    </main>
  );
}
