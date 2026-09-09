"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getRunDocumentById } from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import { RequireAuth } from "../../../components/RequireAuth";

type RunDocument = Awaited<ReturnType<typeof getRunDocumentById>>;

export default function RunDocumentPage() {
  return (
    <RequireAuth>
      <RunDocument />
    </RequireAuth>
  );
}

function RunDocument() {
  const params = useParams<{ id: string }>();
  const [document, setDocument] = useState<RunDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRunDocumentById(params.id)
      .then(setDocument)
      .catch((err) => setError(errorMessage(err, "Failed to load document")))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main>
        <div className="empty-state">{error ?? "Document not found."}</div>
      </main>
    );
  }

  const run = document.onboarding_runs;

  return (
    <main>
      <div className="proposal-actions no-print">
        <Link href="/proposals">&larr; Back to proposals</Link>
        <div className="proposal-action-buttons">
          <button
            type="button"
            className="button-primary"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Reuses the proposal's light island, so this prints white on the dark
          app exactly like a proposal does. */}
      <article className="proposal">
        <header className="proposal-header">
          <div className="proposal-agency proposal-agency-lead">
            {document.name}
          </div>
        </header>

        {run && (
          <section className="proposal-block">
            <span className="proposal-label">Prepared for</span>
            <p className="proposal-client">{run.client_name}</p>
            <p className="proposal-industry">{run.tier_name}</p>
          </section>
        )}

        {/* Plain text, never HTML — pre-wrap keeps the author's line breaks
            without letting a template inject markup. */}
        <div className="document-body">{document.body}</div>
      </article>
    </main>
  );
}
