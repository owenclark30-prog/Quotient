"use client";

import { useState } from "react";
import type { Industry } from "@/lib/supabase/types";
import {
  createIndustry,
  deleteIndustry,
  updateIndustry,
} from "@/lib/data/industries";
import { errorMessage } from "@/lib/errors";

export function IndustriesEditor({
  industries,
  onChanged,
  onError,
}: {
  industries: Industry[];
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    onError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="section-title">Industries</h2>
      <p className="field-hint section-intro">
        Optional. Tag a proposal with the vertical it&rsquo;s for — useful when
        you sell the same tiers into different markets.
      </p>

      {industries.length === 0 && (
        <div className="empty-state">
          No industries yet. Proposals just won&rsquo;t show one.
        </div>
      )}

      {industries.map((industry) => (
        <IndustryRow
          key={industry.id}
          industry={industry}
          busy={busy === industry.id}
          onSave={(name) =>
            run(industry.id, () => updateIndustry(industry.id, name))
          }
          onDelete={() => run(industry.id, () => deleteIndustry(industry.id))}
        />
      ))}

      <div className="editor-row editor-row-new">
        <input
          type="text"
          placeholder="e.g. Aesthetics clinics"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="button-secondary"
          disabled={!newName.trim() || busy === "new"}
          onClick={() =>
            run("new", async () => {
              await createIndustry(newName.trim());
              setNewName("");
            })
          }
        >
          {busy === "new" ? "Adding…" : "Add"}
        </button>
      </div>
    </section>
  );
}

function IndustryRow({
  industry,
  busy,
  onSave,
  onDelete,
}: {
  industry: Industry;
  busy: boolean;
  onSave: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(industry.name);
  const dirty = name.trim() !== industry.name;

  return (
    <div className="editor-row">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        className="button-secondary"
        disabled={!dirty || !name.trim() || busy}
        onClick={() => onSave(name.trim())}
      >
        Save
      </button>
      <button
        type="button"
        className="link-button danger"
        disabled={busy}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
