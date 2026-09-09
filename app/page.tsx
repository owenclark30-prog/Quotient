"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProposals } from "@/lib/data/proposals";
import { getServices } from "@/lib/data/services";
import { getTiers } from "@/lib/data/tiers";
import { errorMessage } from "@/lib/errors";
import { RequireAuth } from "./components/RequireAuth";

type Proposal = Awaited<ReturnType<typeof getProposals>>[number];

const RECENT_LIMIT = 3;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function HomePage() {
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}

function Home() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tierCount, setTierCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [proposalsData, tiersData, servicesData] = await Promise.all([
          getProposals(),
          getTiers(),
          getServices(),
        ]);
        setProposals(proposalsData);
        setTierCount(tiersData.length);
        setServiceCount(servicesData.length);
      } catch (err) {
        setError(errorMessage(err, "Failed to load your dashboard"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Nothing priced yet: a count of zero is true but useless, so the page
  // points at the one thing that has to happen first instead.
  const rateCardEmpty = !loading && !error && tierCount === 0;

  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-mark">Quotient</h1>
        <p className="hero-motto">Price the offer. Send the proposal.</p>
        <Link href="/proposals/new" className="button-primary hero-cta">
          New proposal
        </Link>
      </section>

      {error && <div className="empty-state error-state">{error}</div>}

      {rateCardEmpty && (
        <div className="empty-state">
          Your rate card is empty.{" "}
          <Link href="/rate-card">Build it first</Link> — add your services,
          group them into tiers, and set your fees.
        </div>
      )}

      {!error && !rateCardEmpty && (
        <>
          <div className="stat-row">
            <Stat
              label="Proposals sent"
              value={loading ? null : proposals.length}
            />
            <Stat label="Tiers" value={loading ? null : tierCount} />
            <Stat label="Services" value={loading ? null : serviceCount} />
          </div>

          <section className="home-section">
            <div className="home-section-header">
              <h2 className="section-title">Recent proposals</h2>
              {proposals.length > RECENT_LIMIT && (
                <Link href="/proposals" className="text-link">
                  View all &rarr;
                </Link>
              )}
            </div>

            {loading ? (
              <p className="field-hint">Loading…</p>
            ) : proposals.length === 0 ? (
              <div className="empty-state">
                Nothing sent yet.{" "}
                <Link href="/proposals/new">Price your first client.</Link>
              </div>
            ) : (
              <ul className="proposal-list">
                {proposals.slice(0, RECENT_LIMIT).map((proposal) => (
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
          </section>
        </>
      )}
    </main>
  );
}

/** Value stays in text ink, never the accent — a coloured number reads as
 * decoration and loses contrast. The accent is on the wordmark. */
function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value === null ? "—" : value}</span>
    </div>
  );
}
