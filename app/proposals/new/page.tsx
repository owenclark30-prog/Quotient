"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIndustries } from "@/lib/data/industries";
import { getTiers, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRules } from "@/lib/data/pricing-rules";
import {
  getCostSettingsOrDefault,
  type AgencyCostSettings,
} from "@/lib/data/cost-settings";
import { stashPricing, type PricingHandoff } from "@/lib/pricing-handoff";
import { errorMessage } from "@/lib/errors";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { ClientNameInput } from "../../components/ClientNameInput";
import { IndustrySelect } from "../../components/IndustrySelect";
import { TierPicker } from "../../components/TierPicker";
import { PricingSummary } from "../../components/PricingSummary";
import { PriceThisClient } from "../../components/PriceThisClient";
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
  const [costSettings, setCostSettings] = useState<AgencyCostSettings | null>(
    null
  );
  const [pricing, setPricing] = useState<PricingHandoff | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [industriesData, tiersData, pricingRulesData, costResult] =
          await Promise.all([
            getIndustries(),
            getTiers(),
            getPricingRules(),
            getCostSettingsOrDefault(),
          ]);

        setIndustries(industriesData);
        setTiers(tiersData);
        setPricingRules(pricingRulesData);
        setCostSettings(costResult.settings);

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

  const selectedTier = useMemo(
    () => tiers.find((tier) => tier.id === selectedTierId) ?? null,
    [tiers, selectedTierId]
  );

  const canGenerateProposal =
    clientName.trim().length > 0 && selectedTierId && selectedRule;

  function handleGenerateProposal() {
    if (!canGenerateProposal || !selectedTierId) return;

    const params = new URLSearchParams({
      client: clientName.trim(),
      tier: selectedTierId,
    });
    if (selectedIndustryId) params.set("industry", selectedIndustryId);

    // The snapshot travels by key, not in the URL. If storage is unavailable
    // the proposal still generates — from the rate card, with no expected
    // return — rather than failing on an optional aid.
    if (pricing) {
      const key = stashPricing(pricing);
      if (key) params.set("pricing", key);
    }

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

          {selectedTier && selectedRule && costSettings && (
            /* Keyed on the tier: picking a different one re-reads its services
               and hours from scratch rather than keeping the last tier's
               ticked levers. */
            <PriceThisClient
              key={selectedTier.id}
              tier={selectedTier}
              serviceNames={(tierServices[selectedTier.id] ?? []).map(
                (service) => service.name
              )}
              rule={selectedRule}
              costSettings={costSettings}
              onChange={setPricing}
            />
          )}
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
