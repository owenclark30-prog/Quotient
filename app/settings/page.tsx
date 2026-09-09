"use client";

import { useEffect, useState } from "react";
import { getAgencyIdentityOrDefault } from "@/lib/data/settings";
import type { AgencyIdentity } from "@/lib/supabase/types";
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
  const [identity, setIdentity] = useState<AgencyIdentity | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    getAgencyIdentityOrDefault().then((result) => {
      setIdentity(result.identity);
      setWarning(result.warning);
    });
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
      <p className="subtitle">Details that appear on your proposals</p>

      {warning && (
        <div className="warning-banner">
          {warning} — showing the placeholder below. Saving will overwrite
          whatever is currently stored.
        </div>
      )}

      <AgencySettings value={identity} onSaved={setIdentity} />
    </main>
  );
}
