"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProposals } from "@/lib/data/proposals";
import { errorMessage } from "@/lib/errors";
import { RequireAuth } from "../components/RequireAuth";

type ProposalListItem = Awaited<ReturnType<typeof getProposals>>[number];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProposalsPage() {
  return (
    <RequireAuth>
      <ProposalsList />
    </RequireAuth>
  );
}

function ProposalsList() {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setProposals(await getProposals());
      } catch (err) {
        setError(
          errorMessage(err, "Failed to load proposals")
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main>
      <div className="proposal-actions">
        <Link href="/" className="text-link">
          &larr; Back to calculator
        </Link>
      </div>

      <h1>Past Proposals</h1>
      <p className="subtitle">Proposals you&rsquo;ve saved</p>

      {loading && <p className="subtitle">Loading…</p>}
      {error && <div className="empty-state">{error}</div>}

      {!loading && !error && proposals.length === 0 && (
        <div className="empty-state">
          No proposals saved yet. Generate one from the calculator.
        </div>
      )}

      {!loading && !error && proposals.length > 0 && (
        <ul className="proposal-list">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                href={`/proposal?id=${proposal.id}`}
                className="proposal-list-item"
              >
                <div>
                  <div className="proposal-list-client">
                    {proposal.client_name}
                  </div>
                  <div className="proposal-list-tier">
                    {proposal.tier_name}
                  </div>
                </div>
                <div className="proposal-list-date">
                  {formatDate(proposal.created_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
