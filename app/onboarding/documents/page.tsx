"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createOnboardingDocument,
  getOnboardingDocuments,
  getTierDocumentLinks,
} from "@/lib/data/onboarding";
import { getTiers } from "@/lib/data/tiers";
import { errorMessage } from "@/lib/errors";
import type { OnboardingDocument, Tier } from "@/lib/supabase/types";
import { OnboardingDocumentEditor } from "../../components/OnboardingDocumentEditor";
import { RequireAuth } from "../../components/RequireAuth";

const STARTER_BODY = `Welcome aboard, {{client_name}}.

Here's what happens next and what's included in your {{tier_name}} package.

{{services}}

If anything here needs changing, just reply to this and we'll sort it.

— {{agency_name}}`;

export default function OnboardingDocumentsPage() {
  return (
    <RequireAuth>
      <OnboardingDocuments />
    </RequireAuth>
  );
}

function OnboardingDocuments() {
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [links, setLinks] = useState<
    { tier_id: string; document_id: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [documentsData, tiersData, linksData] = await Promise.all([
      getOnboardingDocuments(),
      getTiers(),
      getTierDocumentLinks(),
    ]);
    setDocuments(documentsData);
    setTiers(tiersData);
    setLinks(linksData);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err, "Failed to load documents")))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      // Seeded with a working example, so the placeholder syntax is obvious
      // from the first document rather than from the hint text.
      await createOnboardingDocument(name, STARTER_BODY);
      setNewName("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't create that document."));
    } finally {
      setAdding(false);
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
      <h1>Onboarding documents</h1>
      <p className="subtitle">
        Templates you reuse — filled in from a proposal when you attach them
      </p>

      {error && <div className="empty-state error-state">{error}</div>}

      {documents.length === 0 && (
        <div className="empty-state">
          No documents yet. A welcome pack, an intake form, a kickoff checklist
          — anything you send every new client.
        </div>
      )}

      {documents.map((document) => (
        <OnboardingDocumentEditor
          key={document.id}
          document={document}
          tiers={tiers}
          linkedTierIds={
            new Set(
              links
                .filter((link) => link.document_id === document.id)
                .map((link) => link.tier_id)
            )
          }
          onChanged={load}
          onError={setError}
        />
      ))}

      <div className="editor-row editor-row-new">
        <input
          type="text"
          value={newName}
          placeholder="e.g. Welcome pack"
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New document name"
        />
        <button
          type="button"
          className="button-primary"
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
    </main>
  );
}
