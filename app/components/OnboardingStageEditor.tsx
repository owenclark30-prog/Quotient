"use client";

import { useState } from "react";
import {
  deleteOnboardingStage,
  updateOnboardingStage,
} from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import type { OnboardingStage } from "@/lib/supabase/types";

/** `0` is kickoff day, negatives are before it. Null means the stage isn't
 * tied to a day at all. */
export function formatDayOffset(dayOffset: number | null) {
  if (dayOffset == null) return null;
  if (dayOffset === 0) return "Kickoff";
  if (dayOffset > 0) return `Day ${dayOffset}`;
  return `${Math.abs(dayOffset)} before`;
}

export function OnboardingStageEditor({
  stage,
  isFirst,
  isLast,
  onMove,
  onChanged,
  onError,
}: {
  stage: OnboardingStage;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => Promise<void>;
  onChanged: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(stage.title);
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [day, setDay] = useState(
    stage.day_offset == null ? "" : String(stage.day_offset)
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const parsedDay = day.trim() === "" ? null : Number(day);
  const dayIsValid = parsedDay === null || Number.isInteger(parsedDay);
  const isDirty =
    title.trim() !== stage.title ||
    (notes.trim() || null) !== stage.notes ||
    parsedDay !== stage.day_offset;
  const canSave = isDirty && title.trim().length > 0 && dayIsValid && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    onError(null);
    try {
      await updateOnboardingStage(stage.id, {
        title: title.trim(),
        notes: notes.trim() || null,
        day_offset: parsedDay,
      });
      await onChanged();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      onError(errorMessage(err, "Couldn't save that stage."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    onError(null);
    try {
      await deleteOnboardingStage(stage.id);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err, "Couldn't delete that stage."));
    }
  }

  return (
    <div className="stage-row">
      <div className="stage-move">
        <button
          type="button"
          className="link-button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={`Move ${stage.title} earlier`}
        >
          ↑
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={`Move ${stage.title} later`}
        >
          ↓
        </button>
      </div>

      <div className="stage-fields">
        <div className="stage-top">
          <input
            type="text"
            className="stage-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Stage title"
          />
          <input
            type="text"
            inputMode="numeric"
            className="stage-day"
            value={day}
            placeholder="Day"
            onChange={(e) => setDay(e.target.value)}
            aria-label="Day offset, relative to kickoff"
          />
        </div>
        <input
          type="text"
          value={notes}
          placeholder="Notes (optional)"
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Stage notes"
        />
        {!dayIsValid && (
          <p className="field-hint stage-invalid">
            Day must be a whole number — 0 for kickoff, -2 for two days before.
          </p>
        )}
      </div>

      <div className="stage-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? "Saving…" : justSaved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          className="link-button danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
