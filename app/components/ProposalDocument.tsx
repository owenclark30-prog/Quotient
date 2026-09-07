import type { PricingRule, Service, Tier } from "@/lib/supabase/types";
import { formatGBP, formatSlug } from "@/lib/format";
import { AGENCY_NAME } from "@/lib/config";

export function ProposalDocument({
  clientName,
  industryName,
  tier,
  services,
  rule,
  generatedDate,
}: {
  clientName: string;
  industryName: string | null;
  tier: Tier;
  services: Service[];
  rule: PricingRule;
  generatedDate: string;
}) {
  const hasFoundingRate =
    rule.founding_setup_fee != null || rule.founding_monthly_fee != null;

  const setupFee = rule.founding_setup_fee ?? rule.setup_fee;
  const monthlyFee = rule.founding_monthly_fee ?? rule.monthly_fee;

  return (
    <article className="proposal">
      <header className="proposal-header">
        <div className="proposal-agency">{AGENCY_NAME}</div>
        <div className="proposal-date">{generatedDate}</div>
      </header>

      <h1 className="proposal-title">Proposal</h1>

      <section className="proposal-block">
        <span className="proposal-label">Prepared for</span>
        <p className="proposal-client">{clientName}</p>
        {industryName && (
          <p className="proposal-industry">{industryName}</p>
        )}
      </section>

      <section className="proposal-block">
        <span className="proposal-label">Package</span>
        <h2 className="proposal-tier-name">{tier.name}</h2>
        {tier.description && (
          <p className="proposal-tier-description">{tier.description}</p>
        )}
      </section>

      <section className="proposal-block">
        <span className="proposal-label">What&rsquo;s included</span>
        <ul className="proposal-services">
          {services.map((service) => (
            <li key={service.id}>
              <span className="proposal-service-name">
                {formatSlug(service.name)}
              </span>
              {service.description && (
                <span className="proposal-service-desc">
                  {" "}
                  — {service.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="proposal-block">
        <span className="proposal-label">Investment</span>
        <table className="proposal-pricing">
          <tbody>
            <tr>
              <td>Setup fee</td>
              <td>
                {formatGBP(setupFee)}
                {rule.founding_setup_fee != null && (
                  <>
                    {" "}
                    <span className="proposal-founding-tag">
                      Founding rate
                    </span>
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td>Monthly fee</td>
              <td>
                {formatGBP(monthlyFee)}/mo
                {rule.founding_monthly_fee != null &&
                  ` for the first ${rule.founding_duration_months} months`}
              </td>
            </tr>
            {rule.founding_monthly_fee != null && (
              <tr>
                <td>From month {rule.founding_duration_months! + 1}</td>
                <td>{formatGBP(rule.monthly_fee)}/mo</td>
              </tr>
            )}
          </tbody>
        </table>
        {hasFoundingRate && (
          <p className="proposal-pricing-note">
            Founding rate applies to the first client(s) onboarded under this
            package.
          </p>
        )}
      </section>

      <footer className="proposal-footer">
        Prepared by {AGENCY_NAME} · {generatedDate}
      </footer>
    </article>
  );
}
