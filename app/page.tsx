"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIndustries } from "@/lib/data/industries";
import { getTiers, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRules } from "@/lib/data/pricing-rules";
import { getAgencyNameOrDefault } from "@/lib/data/settings";
import { errorMessage } from "@/lib/errors";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";
import { AgencySettings } from "./components/AgencySettings";
import { ClientNameInput } from "./components/ClientNameInput";
import { IndustrySelect } from "./components/IndustrySelect";
import { TierPicker } from "./components/TierPicker";
import { PricingSummary } from "./components/PricingSummary";
import { RequireAuth } from "./components/RequireAuth";

export default function HomePage() {
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}

function Home() {
  const router = useRouter();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [tierServices, setTierServices] = useState<Record<string, Service[]>>(
    {}
  );
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(
    null
  );
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [industriesData, tiersData, pricingRulesData, agency] =
          await Promise.all([
            getIndustries(),
            getTiers(),
            getPricingRules(),
            getAgencyNameOrDefault(),
          ]);

        setIndustries(industriesData);
        setTiers(tiersData);
        setPricingRules(pricingRulesData);
        setAgencyName(agency.agencyName);
        setWarning(agency.warning);

        const servicesByTier = await Promise.all(
          tiersData.map(async (tier) => {
            const rows = await getTierWithServices(tier.id);
            return [
              tier.id,
              rows.map((row) => row.services).filter(Boolean) as Service[],
            ] as const;
          })
        );
        setTierServices(Object.fromEntries(servicesByTier));
      } catch (err) {
        setError(errorMessage(err, "Failed to load data"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedRule = useMemo(() => {
    if (!selectedTierId) return null;

    const industryMatch = selectedIndustryId
      ? pricingRules.find(
          (rule) =>
            rule.tier_id === selectedTierId &&
            rule.industry_id === selectedIndustryId
        )
      : null;

    if (industryMatch) return industryMatch;

    return (
      pricingRules.find(
        (rule) => rule.tier_id === selectedTierId && rule.industry_id === null
      ) ?? null
    );
  }, [selectedTierId, selectedIndustryId, pricingRules]);

  const canGenerateProposal = clientName.trim().length > 0 && selectedTierId;

  function handleGenerateProposal() {
    if (!canGenerateProposal || !selectedTierId) return;

    const params = new URLSearchParams({
      client: clientName.trim(),
      tier: selectedTierId,
    });
    if (selectedIndustryId) params.set("industry", selectedIndustryId);

    router.push(`/proposal?${params.toString()}`);
  }

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>Quotient</h1>
        <div className="empty-state">{error}</div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Quotient</h1>
          <p className="subtitle">Pricing calculator</p>
        </div>
        <div className="header-actions">
          <Link href="/proposals" className="text-link">
            Past proposals &rarr;
          </Link>
          <button
            type="button"
            className="link-button"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </div>

      {warning && (
        <div className="warning-banner">
          {warning} — showing the placeholder below. Saving will overwrite
          whatever name is currently stored.
        </div>
      )}

      <AgencySettings value={agencyName} onSaved={setAgencyName} />

      <hr className="divider" />

      <ClientNameInput value={clientName} onChange={setClientName} />

      <IndustrySelect
        industries={industries}
        value={selectedIndustryId}
        onChange={setSelectedIndustryId}
      />

      <TierPicker
        tiers={tiers}
        tierServices={tierServices}
        selectedTierId={selectedTierId}
        onSelect={setSelectedTierId}
      />

      <PricingSummary rule={selectedRule} />

      <section>
        <button
          type="button"
          className="button-primary"
          disabled={!canGenerateProposal}
          onClick={handleGenerateProposal}
        >
          Generate Proposal
        </button>
      </section>
    </main>
  );
}
