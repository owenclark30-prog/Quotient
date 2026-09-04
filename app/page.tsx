"use client";

import { useEffect, useMemo, useState } from "react";
import { getIndustries } from "@/lib/data/industries";
import { getTiers, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRules } from "@/lib/data/pricing-rules";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { IndustrySelect } from "./components/IndustrySelect";
import { TierPicker } from "./components/TierPicker";
import { PricingSummary } from "./components/PricingSummary";

export default function Home() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [tierServices, setTierServices] = useState<Record<string, Service[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : "Failed to load data");
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
      <h1>Quotient</h1>
      <p className="subtitle">Pricing calculator</p>

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
    </main>
  );
}
