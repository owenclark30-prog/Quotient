"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAgencyIdentityOrDefault } from "@/lib/data/settings";
import { getIndustryById } from "@/lib/data/industries";
import { getTierById, getTierWithServices } from "@/lib/data/tiers";
import { getPricingRule } from "@/lib/data/pricing-rules";
import { createProposal, getProposalById } from "@/lib/data/proposals";
import {
  createOnboardingRun,
  getOnboardingDocuments,
  getRunDocuments,
  getRunForProposal,
  getTierDocumentLinks,
} from "@/lib/data/onboarding";
import { errorMessage } from "@/lib/errors";
import type {
  OnboardingDocument,
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
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [agencyEmail, setAgencyEmail] = useState<string | null>(null);
  const [agencyWebsite, setAgencyWebsite] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());
  const [saved, setSaved] = useState(false);

  const [tierName, setTierName] = useState<string | null>(null);
  const [tierDescription, setTierDescription] = useState<string | null>(null);
  const [services, setServices] = useState<ProposalServiceSnapshot[]>([]);
  const [industryName, setIndustryName] = useState<string | null>(null);
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Templates offered before saving; frozen copies after.
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set()
  );
  const [attached, setAttached] = useState<
    { id: string; name: string }[]
  >([]);

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
          setAgencyLogo(proposal.agency_logo);
          setAgencyEmail(proposal.agency_email);
          setAgencyWebsite(proposal.agency_website);
          setDocumentDate(new Date(proposal.created_at));
          setSaved(true);
          setTierName(proposal.tier_name);
          setTierDescription(proposal.tier_description);
          setServices(proposal.services);
          setPricing(proposal);
          setIndustryName(proposal.industry_name);

          const run = await getRunForProposal(proposal.id);
          // Frozen at save time; the live templates are never consulted here.
          setAttached(run ? await getRunDocuments(run.id) : []);
        } else if (clientParam && tierParam) {
          const [tierData, tierServiceRows, pricingRule, industryData, agency] =
            await Promise.all([
              getTierById(tierParam),
              getTierWithServices(tierParam),
              getPricingRule(tierParam, industryParam),
              industryParam ? getIndustryById(industryParam) : Promise.resolve(null),
              getAgencyIdentityOrDefault(),
            ]);

          const [documentsData, links] = await Promise.all([
            getOnboardingDocuments(),
            getTierDocumentLinks(),
          ]);
          setDocuments(documentsData);
          setSelectedDocumentIds(
            new Set(
              links
                .filter((link) => link.tier_id === tierParam)
                .map((link) => link.document_id)
            )
          );

          setClientName(clientParam);
          setTierId(tierParam);
          setIndustryId(industryParam);
          setAgencyName(agency.identity.agencyName);
          setAgencyLogo(agency.identity.logo);
          setAgencyEmail(agency.identity.contactEmail);
          setAgencyWebsite(agency.identity.website);
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
          setIndustryName(industryData?.name ?? null);
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
        agency_logo: agencyLogo,
        agency_email: agencyEmail,
        agency_website: agencyWebsite,
        industry_name: industryName,
        tier_name: tierName,
        tier_description: tierDescription,
        services,
        setup_fee: pricing.setup_fee,
        monthly_fee: pricing.monthly_fee,
        founding_setup_fee: pricing.founding_setup_fee,
        founding_monthly_fee: pricing.founding_monthly_fee,
        founding_duration_months: pricing.founding_duration_months,
      });

      const chosen = documents.filter((document) =>
        selectedDocumentIds.has(document.id)
      );
      if (chosen.length > 0) {
        try {
          await createOnboardingRun({
            proposalId: created.id,
            tierId,
            values: {
              client_name: clientName,
              agency_name: agencyName,
              tier_name: tierName,
              services,
              // The same frozen pricing the proposal renders, so a document
              // can never quote a different figure to the quote it came with.
              pricing,
            },
            documents: chosen,
          });
        } catch (err) {
          // The proposal itself is already saved, so this must not read as a
          // failed save — say exactly what did and didn't happen.
          setError(
            `Proposal saved, but the onboarding documents couldn't be attached: ${errorMessage(
              err,
              "unknown error"
            )}`
          );
        }
      }

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
          <Link href="/proposals/new">Go back and choose a tier.</Link>
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
        <Link href={saved ? "/proposals" : "/proposals/new"}>
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

      {!saved && documents.length > 0 && (
        <section className="no-print onboarding-attach">
          <label>Attach onboarding documents</label>
          <div className="checkbox-list">
            {documents.map((document) => (
              <label key={document.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.has(document.id)}
                  onChange={(e) =>
                    setSelectedDocumentIds((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.add(document.id);
                      else next.delete(document.id);
                      return next;
                    })
                  }
                />
                {document.name}
              </label>
            ))}
          </div>
          <p className="field-hint">
            Filled in from this proposal and frozen when you save. Editing a
            template later won't change the copy this client gets.
          </p>
        </section>
      )}

      {saved && attached.length > 0 && (
        <section className="no-print onboarding-attach">
          <label>Onboarding documents</label>
          <ul className="proposal-list">
            {attached.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/onboarding/document/${document.id}`}
                  className="proposal-list-item"
                >
                  <div className="proposal-list-client">{document.name}</div>
                  <div className="proposal-list-date">View &rarr;</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProposalDocument
        clientName={clientName}
        industryName={industryName}
        tierName={tierName}
        tierDescription={tierDescription}
        services={services}
        pricing={pricing}
        agencyName={agencyName}
        agencyLogo={agencyLogo}
        agencyEmail={agencyEmail}
        agencyWebsite={agencyWebsite}
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
