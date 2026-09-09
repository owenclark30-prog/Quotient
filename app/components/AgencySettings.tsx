"use client";

import { useRef, useState } from "react";
import { updateAgencyIdentity } from "@/lib/data/settings";
import { errorMessage } from "@/lib/errors";
import { fileToLogoDataUri } from "@/lib/logo";
import type { AgencyIdentity } from "@/lib/supabase/types";

export function AgencySettings({
  value,
  onSaved,
}: {
  value: AgencyIdentity;
  onSaved: (identity: AgencyIdentity) => void;
}) {
  const [draft, setDraft] = useState<AgencyIdentity>(value);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof AgencyIdentity>(
    key: K,
    fieldValue: AgencyIdentity[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: fieldValue }));
    setJustSaved(false);
  };

  const nameIsValid = draft.agencyName.trim().length > 0;
  const isDirty =
    draft.agencyName.trim() !== value.agencyName ||
    draft.logo !== value.logo ||
    (draft.contactEmail?.trim() || null) !== value.contactEmail ||
    (draft.website?.trim() || null) !== value.website;

  async function handleLogoPicked(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      set("logo", await fileToLogoDataUri(file));
    } catch (err) {
      setError(errorMessage(err, "Couldn't read that image."));
    } finally {
      // Let the same file be picked again after a failure or a removal.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSave() {
    if (!isDirty || !nameIsValid) return;
    setSaving(true);
    setError(null);
    try {
      const saved: AgencyIdentity = {
        agencyName: draft.agencyName.trim(),
        logo: draft.logo,
        contactEmail: draft.contactEmail?.trim() || null,
        website: draft.website?.trim() || null,
      };
      await updateAgencyIdentity(saved);
      setDraft(saved);
      onSaved(saved);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && <div className="empty-state error-state">{error}</div>}

      <section>
        <label htmlFor="agency-name">Agency name</label>
        <input
          id="agency-name"
          type="text"
          value={draft.agencyName}
          onChange={(e) => set("agencyName", e.target.value)}
        />
        <p className="field-hint">Shown on every proposal you generate.</p>
      </section>

      <section>
        <label>Logo</label>
        <div className="logo-row">
          {draft.logo ? (
            // Decorative: the agency name sits beside it on the proposal, so
            // announcing it again would just repeat.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.logo} alt="" className="logo-preview" />
          ) : (
            <div className="logo-preview logo-preview-empty">No logo</div>
          )}
          <div className="logo-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => fileInput.current?.click()}
            >
              {draft.logo ? "Replace" : "Upload"}
            </button>
            {draft.logo && (
              <button
                type="button"
                className="link-button danger"
                onClick={() => set("logo", null)}
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleLogoPicked(e.target.files?.[0])}
          />
        </div>
        <p className="field-hint">
          Appears above your agency name in the proposal header. A PNG with a
          transparent background works best — it sits on white.
        </p>
      </section>

      <section>
        <label htmlFor="contact-email">Contact email (optional)</label>
        <input
          id="contact-email"
          type="email"
          value={draft.contactEmail ?? ""}
          onChange={(e) => set("contactEmail", e.target.value)}
        />
      </section>

      <section>
        <label htmlFor="website">Website (optional)</label>
        <input
          id="website"
          type="text"
          value={draft.website ?? ""}
          onChange={(e) => set("website", e.target.value)}
          placeholder="ascendgrowth.co"
        />
        <p className="field-hint">
          Both appear in the proposal footer, so a client can reply or look you
          up.
        </p>
      </section>

      <section>
        <button
          type="button"
          className="button-primary"
          onClick={handleSave}
          disabled={!isDirty || !nameIsValid || saving}
        >
          {saving ? "Saving…" : justSaved ? "Saved" : "Save settings"}
        </button>
      </section>
    </>
  );
}
