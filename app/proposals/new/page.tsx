"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIndustries } from "@/lib/data/industries";
import { getTiers, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRules } from "@/lib/data/pricing-rules";
import { errorMessage } from "@/lib/errors";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { ClientNameInput } from "../../components/ClientNameInput";
import { IndustrySelect } from "../../components/IndustrySelect";
import { TierPicker } from "../../components/TierPicker";
import { PricingSummary } from "../../components/PricingSummary";
import { RequireAuth } from "../../components/RequireAuth";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(
    null
  );
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [industriesData, tiersData, pricingRulesData] =
          await Promise.all([getIndustries(), getTiers(), getPricingRules()]);

        setIndustries(industriesData);
        setTiers(tiersData);
        setPricingRules(pricingRulesData);

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

  const canGenerateProposal =
    clientName.trim().length > 0 && selectedTierId && selectedRule;

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
        <h1>New proposal</h1>
        <div className="empty-state">{error}</div>
      </main>
    );
  }

  return (
    <main>
      <h1>New proposal</h1>
      <p className="subtitle">Pricing calculator</p>

      <ClientNameInput value={clientName} onChange={setClientName} />

      {industries.length > 0 && (
        <IndustrySelect
          industries={industries}
          value={selectedIndustryId}
          onChange={setSelectedIndustryId}
        />
      )}

      {tiers.length === 0 ? (
        <section>
          <label>Tier</label>
          <div className="empty-state">
            Your rate card is empty.{" "}
            <Link href="/rate-card">Build it first</Link> — add your services,
            group them into tiers, and set your fees.
          </div>
        </section>
      ) : (
        <>
          <TierPicker
            tiers={tiers}
            tierServices={tierServices}
            selectedTierId={selectedTierId}
            onSelect={setSelectedTierId}
          />

          <PricingSummary rule={selectedRule} />
        </>
      )}

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
