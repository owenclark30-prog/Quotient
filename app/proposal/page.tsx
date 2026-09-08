"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAgencyNameOrDefault } from "@/lib/data/settings";
import { getIndustryById } from "@/lib/data/industries";
import { getTierById, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRule } from "@/lib/data/pricing-rules";
import { createProposal, getProposalById } from "@/lib/data/proposals";
import { errorMessage } from "@/lib/errors";
import type {
  Industry,
  ProposalPricing,
  ProposalServiceSnapshot,
} from "@/lib/supabase/types";
import { ProposalDocument } from "../components/ProposalDocument";
import { RequireAuth } from "../components/RequireAuth";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ProposalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("id");
  const clientParam = searchParams.get("client");
  const tierParam = searchParams.get("tier");
  const industryParam = searchParams.get("industry");

  const hasValidParams = Boolean(proposalId || (clientParam && tierParam));

  const [clientName, setClientName] = useState<string | null>(null);
  const [tierId, setTierId] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());
  const [saved, setSaved] = useState(false);

  const [tierName, setTierName] = useState<string | null>(null);
  const [tierDescription, setTierDescription] = useState<string | null>(null);
  const [services, setServices] = useState<ProposalServiceSnapshot[]>([]);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasValidParams) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (proposalId) {
          const proposal = await getProposalById(proposalId);

          // Everything the document renders was frozen at save time, so a
          // saved proposal never touches the live rate card — editing or
          // deleting a tier can't rewrite a proposal already sent.
          setClientName(proposal.client_name);
          setTierId(proposal.tier_id);
          setIndustryId(proposal.industry_id);
          setAgencyName(proposal.agency_name);
          setDocumentDate(new Date(proposal.created_at));
          setSaved(true);
          setTierName(proposal.tier_name);
          setTierDescription(proposal.tier_description);
          setServices(proposal.services);
          setPricing(proposal);
          setIndustry(
            proposal.industry_id
              ? await getIndustryById(proposal.industry_id).catch(() => null)
              : null
          );
        } else if (clientParam && tierParam) {
          const [tierData, tierServiceRows, pricingRule, industryData, agency] =
            await Promise.all([
              getTierById(tierParam),
              getTierWithServices(tierParam),
              getPricingRule(tierParam, industryParam),
              industryParam ? getIndustryById(industryParam) : Promise.resolve(null),
              getAgencyNameOrDefault(),
            ]);

          setClientName(clientParam);
          setTierId(tierParam);
          setIndustryId(industryParam);
          setAgencyName(agency.agencyName);
          setWarning(agency.warning);
          setDocumentDate(new Date());
          setSaved(false);
          setTierName(tierData.name);
          setTierDescription(tierData.description);
          setServices(
            tierServiceRows
              .map((row) => row.services)
              .filter(Boolean)
              .map((service) => ({
                name: service!.name,
                description: service!.description,
              }))
          );
          setPricing(pricingRule);
          setIndustry(industryData);
        }
      } catch (err) {
        setError(
          errorMessage(err, "Failed to load proposal")
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [hasValidParams, proposalId, clientParam, tierParam, industryParam]);

  async function handleSave() {
    if (!clientName || !tierId || agencyName == null || !pricing || !tierName)
      return;

    setSaving(true);
    setError(null);
    try {
      const created = await createProposal({
        client_name: clientName,
        tier_id: tierId,
        industry_id: industryId,
        agency_name: agencyName,
        tier_name: tierName,
        tier_description: tierDescription,
        services,
        setup_fee: pricing.setup_fee,
        monthly_fee: pricing.monthly_fee,
        founding_setup_fee: pricing.founding_setup_fee,
        founding_monthly_fee: pricing.founding_monthly_fee,
        founding_duration_months: pricing.founding_duration_months,
      });
      setSaved(true);
      router.replace(`/proposal?id=${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save proposal"));
    } finally {
      setSaving(false);
    }
  }

  if (!hasValidParams) {
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

  if (error && !tierName) {
    return (
      <main>
        <div className="empty-state">{error}</div>
      </main>
    );
  }

  if (!tierName || !pricing || !clientName || agencyName == null) {
    return (
      <main>
        <div className="empty-state">Proposal not found.</div>
      </main>
    );
  }

  return (
    <main>
      <div className="proposal-actions no-print">
        <Link href={saved ? "/proposals" : "/"}>
          &larr; {saved ? "Back to proposals" : "Back to calculator"}
        </Link>
        <div className="proposal-action-buttons">
          {!saved && (
            <button
              type="button"
              className="button-secondary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Proposal"}
            </button>
          )}
          <button
            type="button"
            className="button-primary"
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {error && <div className="empty-state no-print">{error}</div>}

      {warning && (
        <div className="warning-banner no-print">
          {warning} — the header below shows the placeholder, not your agency
          name. Reload before sending this to a client.
        </div>
      )}

      <ProposalDocument
        clientName={clientName}
        industryName={industry?.name ?? null}
        tierName={tierName}
        tierDescription={tierDescription}
        services={services}
        pricing={pricing}
        agencyName={agencyName}
        generatedDate={formatDate(documentDate)}
      />
    </main>
  );
}

export default function ProposalPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <main>
            <p className="subtitle">Loading…</p>
          </main>
        }
      >
        <ProposalContent />
      </Suspense>
    </RequireAuth>
  );
}
