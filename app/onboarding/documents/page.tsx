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
import {
  BLANK_STARTER,
  DOCUMENT_STARTERS,
  type DocumentStarter,
} from "@/lib/onboarding-starters";
import { OnboardingDocumentEditor } from "../../components/OnboardingDocumentEditor";
import { RequireAuth } from "../../components/RequireAuth";



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
  const [notice, setNotice] = useState<string | null>(null);

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

  async function add(name: string, body: string, caution?: string) {
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      await createOnboardingDocument(name, body);
      await load();
      if (caution) setNotice(caution);
    } catch (err) {
      setError(errorMessage(err, "Couldn't create that document."));
    } finally {
      setAdding(false);
    }
  }

  async function handleStarter(starter: DocumentStarter) {
    await add(starter.name, starter.body, starter.caution);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    // Custom documents get a minimal working example, so the placeholder
    // syntax is obvious from the first one rather than from the hint text.
    await add(name, BLANK_STARTER);
    setNewName("");
  }

  const existingNames = new Set(
    documents.map((document) => document.name.toLowerCase())
  );

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
      {notice && <div className="warning-banner">{notice}</div>}

      <section>
        <label>Start from a common document</label>
        <div className="starter-grid">
          {DOCUMENT_STARTERS.map((starter) => {
            // Names are unique per user, so a second click would just fail at
            // the database. Say why it's unavailable instead.
            const exists = existingNames.has(starter.name.toLowerCase());
            return (
              <button
                key={starter.name}
                type="button"
                className="starter-card"
                onClick={() => handleStarter(starter)}
                disabled={exists || adding}
                title={exists ? "You already have this one" : undefined}
              >
                <span className="starter-card-title">
                  {starter.name}
                  {exists && <span className="starter-card-tag">Added</span>}
                </span>
                <span className="starter-card-description">
                  {starter.description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="field-hint">
          Each one is a starting point you own and rewrite — nothing is
          generated per client except the placeholders.
        </p>
      </section>

      {documents.length === 0 && (
        <div className="empty-state">
          No documents yet. Start from one above, or name your own below.
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
        <label htmlFor="new-document" className="editor-row-label">
          Or name your own
        </label>
        <input
          id="new-document"
          type="text"
          value={newName}
          placeholder="e.g. Offboarding summary"
          onChange={(e) => setNewName(e.target.value)}
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
