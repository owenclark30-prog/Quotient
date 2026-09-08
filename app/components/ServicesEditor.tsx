"use client";

import { useState } from "react";
import type { Service } from "@/lib/supabase/types";
import {
  createService,
  deleteService,
  updateService,
} from "@/lib/data/services";
import { errorMessage } from "@/lib/errors";

export function ServicesEditor({
  services,
  onChanged,
  onError,
}: {
  services: Service[];
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
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
      <h2 className="section-title">Services</h2>
      <p className="field-hint section-intro">
        The individual things you deliver. Group them into tiers below.
      </p>

      {services.length === 0 && (
        <div className="empty-state">
          No services yet. Add your first one below.
        </div>
      )}

      {services.map((service) => (
        <ServiceRow
          key={service.id}
          service={service}
          busy={busy === service.id}
          onSave={(name, description) =>
            run(service.id, () =>
              updateService(service.id, { name, description })
            )
          }
          onDelete={() => run(service.id, () => deleteService(service.id))}
        />
      ))}

      <div className="editor-row editor-row-new">
        <input
          type="text"
          placeholder="Service name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Short description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <button
          type="button"
          className="button-secondary"
          disabled={!newName.trim() || busy === "new"}
          onClick={() =>
            run("new", async () => {
              await createService(
                newName.trim(),
                newDescription.trim() || null
              );
              setNewName("");
              setNewDescription("");
            })
          }
        >
          {busy === "new" ? "Adding…" : "Add"}
        </button>
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  busy,
  onSave,
  onDelete,
}: {
  service: Service;
  busy: boolean;
  onSave: (name: string, description: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");

  const dirty =
    name.trim() !== service.name ||
    (description.trim() || null) !== service.description;

  return (
    <div className="editor-row">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        type="button"
        className="button-secondary"
        disabled={!dirty || !name.trim() || busy}
        onClick={() => onSave(name.trim(), description.trim() || null)}
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
