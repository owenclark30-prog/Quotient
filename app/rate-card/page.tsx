"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getServices } from "@/lib/data/services";
import { createTier, getAllTierServices, getTiers } from "@/lib/data/tiers";
import { getPricingRules } from "@/lib/data/pricing-rules";
import { getIndustries } from "@/lib/data/industries";
import { errorMessage } from "@/lib/errors";
import type { Industry, PricingRule, Service, Tier } from "@/lib/supabase/types";
import { RequireAuth } from "../components/RequireAuth";
import { IndustriesEditor } from "../components/IndustriesEditor";
import { ServicesEditor } from "../components/ServicesEditor";
import { TierEditor } from "../components/TierEditor";

export default function RateCardPage() {
  return (
    <RequireAuth>
      <RateCard />
    </RequireAuth>
  );
}

function RateCard() {
  const [services, setServices] = useState<Service[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [membership, setMembership] = useState<
    { tier_id: string; service_id: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingTier, setAddingTier] = useState(false);

  const load = useCallback(async () => {
    const [servicesData, tiersData, rulesData, membershipData, industriesData] =
      await Promise.all([
        getServices(),
        getTiers(),
        getPricingRules(),
        getAllTierServices(),
        getIndustries(),
      ]);

    setServices(servicesData);
    setTiers(tiersData);
    setRules(rulesData);
    setMembership(membershipData);
    setIndustries(industriesData);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err, "Failed to load rate card")))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleAddTier() {
    setAddingTier(true);
    setError(null);
    try {
      const nextLevel =
        tiers.reduce((max, tier) => Math.max(max, tier.level), 0) + 1;
      await createTier(`Tier ${nextLevel}`, null, nextLevel);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to add tier"));
    } finally {
      setAddingTier(false);
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
      <div className="page-header">
        <div>
          <h1>Rate card</h1>
          <p className="subtitle">Your services, tiers and pricing</p>
        </div>
        <Link href="/" className="text-link">
          &larr; Calculator
        </Link>
      </div>

      {error && <div className="empty-state error-state">{error}</div>}

      <ServicesEditor
        services={services}
        onChanged={load}
        onError={setError}
      />

      <hr className="divider" />

      <section>
        <h2 className="section-title">Tiers</h2>
        <p className="field-hint section-intro">
          A tier bundles services at a price. Clients are quoted one tier.
        </p>

        {tiers.length === 0 && (
          <div className="empty-state">
            No tiers yet. Add one to start pricing.
          </div>
        )}

        {tiers.map((tier) => (
          <TierEditor
            key={tier.id}
            tier={tier}
            services={services}
            memberServiceIds={
              new Set(
                membership
                  .filter((row) => row.tier_id === tier.id)
                  .map((row) => row.service_id)
              )
            }
            rule={
              rules.find(
                (rule) => rule.tier_id === tier.id && rule.industry_id === null
              ) ?? null
            }
            onChanged={load}
            onError={setError}
          />
        ))}

        <button
          type="button"
          className="button-primary"
          onClick={handleAddTier}
          disabled={addingTier}
        >
          {addingTier ? "Adding…" : "Add tier"}
        </button>
      </section>

      <hr className="divider" />

      <IndustriesEditor
        industries={industries}
        onChanged={load}
        onError={setError}
      />
    </main>
  );
}
