"use client";

import { useState } from "react";
import { updateAgencyName } from "@/lib/data/settings";

export function AgencySettings({
  value,
  onSaved,
}: {
  value: string;
  onSaved: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const trimmed = draft.trim();
  const isDirty = trimmed.length > 0 && trimmed !== value;

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    try {
      await updateAgencyName(trimmed);
      onSaved(trimmed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <label htmlFor="agency-name">Agency name</label>
      <div className="agency-name-row">
        <input
          id="agency-name"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="button-secondary"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? "Saving…" : justSaved ? "Saved" : "Save"}
        </button>
      </div>
      <p className="field-hint">Shown on every proposal you generate.</p>
    </section>
  );
}
