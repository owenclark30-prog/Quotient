"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getIndustryById } from "@/lib/data/industries";
import { getTierById, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRule } from "@/lib/data/pricing-rules";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { ProposalDocument } from "../components/ProposalDocument";

function ProposalContent() {
  const searchParams = useSearchParams();
  const clientName = searchParams.get("client");
  const tierId = searchParams.get("tier");
  const industryId = searchParams.get("industry");

  const [tier, setTier] = useState<Tier | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [rule, setRule] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientName || !tierId) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [tierData, tierServiceRows, pricingRule, industryData] =
          await Promise.all([
            getTierById(tierId!),
            getTierWithServices(tierId!),
            getPricingRule(tierId!, industryId),
            industryId ? getIndustryById(industryId) : Promise.resolve(null),
          ]);

        setTier(tierData);
        setServices(
          tierServiceRows.map((row) => row.services).filter(Boolean) as Service[]
        );
        setRule(pricingRule);
        setIndustry(industryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load proposal");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [clientName, tierId, industryId]);

  if (!clientName || !tierId) {
    return (
      <main>
        <div className="empty-state">
          No proposal selected.{" "}
          <Link href="/">Go back and choose a tier.</Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (error || !tier || !rule) {
    return (
      <main>
        <div className="empty-state">{error ?? "Proposal not found."}</div>
      </main>
    );
  }

  return (
    <main>
      <div className="proposal-actions no-print">
        <Link href="/">&larr; Back to calculator</Link>
        <button
          type="button"
          className="button-primary"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>

      <ProposalDocument
        clientName={clientName}
        industryName={industry?.name ?? null}
        tier={tier}
        services={services}
        rule={rule}
        generatedDate={new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />
    </main>
  );
}

export default function ProposalPage() {
  return (
    <Suspense
      fallback={
        <main>
          <p className="subtitle">Loading…</p>
        </main>
      }
    >
      <ProposalContent />
    </Suspense>
  );
}
