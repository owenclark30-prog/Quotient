import type {
  ProposalPricing,
  ProposalServiceSnapshot,
} from "@/lib/supabase/types";
import { formatGBP } from "@/lib/format";

export function ProposalDocument({
  clientName,
  industryName,
  tierName,
  tierDescription,
  services,
  pricing,
  agencyName,
  generatedDate,
}: {
  clientName: string;
  industryName: string | null;
  tierName: string;
  tierDescription: string | null;
  services: ProposalServiceSnapshot[];
  pricing: ProposalPricing;
  agencyName: string;
  generatedDate: string;
}) {
  const hasFoundingRate =
    pricing.founding_setup_fee != null || pricing.founding_monthly_fee != null;

  const setupFee = pricing.founding_setup_fee ?? pricing.setup_fee;
  const monthlyFee = pricing.founding_monthly_fee ?? pricing.monthly_fee;

  return (
    <article className="proposal">
      <header className="proposal-header">
        <div className="proposal-agency">{agencyName}</div>
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
        <h2 className="proposal-tier-name">{tierName}</h2>
        {tierDescription && (
          <p className="proposal-tier-description">{tierDescription}</p>
        )}
      </section>

      <section className="proposal-block">
        <span className="proposal-label">What&rsquo;s included</span>
        <ul className="proposal-services">
          {services.map((service) => (
            <li key={service.name}>
              <span className="proposal-service-name">{service.name}</span>
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
                {pricing.founding_setup_fee != null && (
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
                {pricing.founding_monthly_fee != null &&
                  ` for the first ${pricing.founding_duration_months} months`}
              </td>
            </tr>
            {pricing.founding_monthly_fee != null && (
              <tr>
                <td>From month {pricing.founding_duration_months! + 1}</td>
                <td>{formatGBP(pricing.monthly_fee)}/mo</td>
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
        Prepared by {agencyName} · {generatedDate}
      </footer>
    </article>
  );
}
