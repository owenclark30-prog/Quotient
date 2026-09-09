"use client";

import { useState } from "react";
import {
  deleteOnboardingDocument,
  linkDocumentToTier,
  unlinkDocumentFromTier,
  updateOnboardingDocument,
} from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import { PLACEHOLDERS, unknownPlaceholders } from "@/lib/onboarding";
import type { OnboardingDocument, Tier } from "@/lib/supabase/types";

export function OnboardingDocumentEditor({
  document,
  tiers,
  linkedTierIds,
  onChanged,
  onError,
}: {
  document: OnboardingDocument;
  tiers: Tier[];
  linkedTierIds: Set<string>;
  onChanged: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(document.name);
  const [body, setBody] = useState(document.body);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = name.trim() !== document.name || body !== document.body;
  const canSave = isDirty && name.trim().length > 0 && !saving;
  const unknown = unknownPlaceholders(body);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    onError(null);
    try {
      await updateOnboardingDocument(document.id, name.trim(), body);
      await onChanged();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      onError(errorMessage(err, "Couldn't save that document."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    onError(null);
    try {
      await deleteOnboardingDocument(document.id);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err, "Couldn't delete that document."));
    }
  }

  async function toggleTier(tierId: string, linked: boolean) {
    onError(null);
    try {
      if (linked) await unlinkDocumentFromTier(document.id, tierId);
      else await linkDocumentToTier(document.id, tierId);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err, "Couldn't change which tiers use this."));
    }
  }

  return (
    <div className="tier-editor">
      <div className="tier-editor-header">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Document name"
        />
        <button
          type="button"
          className="link-button danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>

      <div className="tier-editor-block">
        <label htmlFor={`body-${document.id}`}>Content</label>
        <textarea
          id={`body-${document.id}`}
          className="template-body"
          value={body}
          rows={12}
          onChange={(e) => setBody(e.target.value)}
        />

        <p className="field-hint">
          Placeholders:{" "}
          {PLACEHOLDERS.map((placeholder, index) => (
            <span key={placeholder.token}>
              {index > 0 && ", "}
              <code>{`{{${placeholder.token}}}`}</code>
            </span>
          ))}
          . Filled in from the proposal when you attach this to one.
        </p>

        {unknown.length > 0 && (
          <div className="warning-banner">
            {unknown.length === 1 ? "This placeholder isn't" : "These placeholders aren't"}{" "}
            recognised and will appear literally on the client&rsquo;s copy:{" "}
            {unknown.map((token) => `{{${token}}}`).join(", ")}
          </div>
        )}
      </div>

      {tiers.length > 0 && (
        <div className="tier-editor-block">
          <label>Attach to these tiers</label>
          <div className="checkbox-list">
            {tiers.map((tier) => {
              const linked = linkedTierIds.has(tier.id);
              return (
                <label key={tier.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={() => toggleTier(tier.id, linked)}
                  />
                  {tier.name}
                </label>
              );
            })}
          </div>
          <p className="field-hint">
            Pre-selected when you generate a proposal for that tier. You can
            still change the selection on the proposal itself.
          </p>
        </div>
      )}

      <button
        type="button"
        className="button-secondary"
        onClick={handleSave}
        disabled={!canSave}
      >
        {saving ? "Saving…" : justSaved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
