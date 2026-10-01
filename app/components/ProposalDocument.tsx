import type {
  ProposalPricing,
  ProposalServiceSnapshot,
} from "@/lib/supabase/types";
import type { ExpectedReturn, FieldUnit } from "@/lib/pricing-snapshot";
import { formatGBP } from "@/lib/format";
import { emailHref, websiteHref, websiteLabel } from "@/lib/agency";

function formatInput(value: number, unit: FieldUnit) {
  if (unit === "money") return formatGBP(value);
  if (unit === "percent") return `${value}%`;
  return value.toLocaleString("en-GB");
}

export function ProposalDocument({
  clientName,
  industryName,
  tierName,
  tierDescription,
  services,
  pricing,
  agencyName,
  agencyLogo,
  agencyEmail,
  agencyWebsite,
  generatedDate,
  expectedReturn = null,
}: {
  clientName: string;
  industryName: string | null;
  tierName: string;
  tierDescription: string | null;
  services: ProposalServiceSnapshot[];
  pricing: ProposalPricing;
  agencyName: string;
  agencyLogo: string | null;
  agencyEmail: string | null;
  agencyWebsite: string | null;
  generatedDate: string;
  /** Null for a proposal priced straight from the rate card — the section is
   * left out entirely rather than rendered empty.
   *
   * This type carries only the client's own figures and the conservative value.
   * The agency's hourly cost, target margin, value range, floor and verdict have
   * no field to arrive in, which is what keeps them off a document a client
   * reads. */
  expectedReturn?: ExpectedReturn | null;
}) {
  const hasFoundingRate =
    pricing.founding_setup_fee != null || pricing.founding_monthly_fee != null;

  const mailto = emailHref(agencyEmail);
  const site = websiteHref(agencyWebsite);
  const siteLabel = websiteLabel(agencyWebsite);
  const hasContact = Boolean(agencyEmail?.trim() || siteLabel);

  const setupFee = pricing.founding_setup_fee ?? pricing.setup_fee;
  const monthlyFee = pricing.founding_monthly_fee ?? pricing.monthly_fee;

  return (
    <article className="proposal">
      <header className="proposal-header">
        <div>
          {agencyLogo && (
            /* Decorative: the agency name is right below it, so alt text here
               would only repeat what a screen reader already reads. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={agencyLogo} alt="" className="proposal-logo" />
          )}
          {/* With no logo the name *is* the letterhead, so it carries the
              weight the logo would have. */}
          <div
            className={`proposal-agency${
              agencyLogo ? "" : " proposal-agency-lead"
            }`}
          >
            {agencyName}
          </div>
        </div>
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

      {expectedReturn && (
        <section className="proposal-block">
          <span className="proposal-label">Expected return</span>

          <p className="proposal-return-intro">
            Worked out from the figures you gave us.
          </p>

          {expectedReturn.levers.map((lever) => (
            <div key={lever.label} className="proposal-return-lever">
              <h3 className="proposal-return-lever-name">{lever.label}</h3>
              <table className="proposal-return-inputs">
                <tbody>
                  {lever.lines.map((line) => (
                    <tr key={line.label}>
                      <td>{line.label}</td>
                      <td>{formatInput(line.value, line.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <table className="proposal-pricing proposal-return-summary">
            <tbody>
              <tr>
                <td>Estimated value to you</td>
                {/* Whole pounds: pence on an estimate this soft reads as false
                    precision, and £2,872.8 reads as a typo. */}
                <td>
                  {formatGBP(Math.round(expectedReturn.conservativeMonthly))}/mo
                </td>
              </tr>
              <tr>
                <td>Your investment</td>
                <td>
                  {formatGBP(expectedReturn.setupFee)} setup +{" "}
                  {formatGBP(expectedReturn.monthlyFee)}/mo
                </td>
              </tr>
              {expectedReturn.paybackMonths != null && (
                <tr>
                  <td>Setup paid back in</td>
                  <td>
                    {expectedReturn.paybackMonths < 1
                      ? "under a month"
                      : `${expectedReturn.paybackMonths.toFixed(1)} months`}
                  </td>
                </tr>
              )}
              {expectedReturn.roi != null && (
                <tr>
                  <td>Return on the monthly fee</td>
                  <td>{expectedReturn.roi.toFixed(1)}×</td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="proposal-pricing-note">
            Estimates based on the figures provided.
          </p>
        </section>
      )}

      <footer className="proposal-footer">
        <div>
          Prepared by {agencyName} · {generatedDate}
        </div>
        {hasContact && (
          <div className="proposal-contact">
            {agencyEmail?.trim() &&
              (mailto ? (
                <a href={mailto}>{agencyEmail.trim()}</a>
              ) : (
                /* Not a usable mailto, but still worth printing. */
                <span>{agencyEmail.trim()}</span>
              ))}
            {agencyEmail?.trim() && siteLabel && (
              <span aria-hidden="true"> · </span>
            )}
            {siteLabel && site && <a href={site}>{siteLabel}</a>}
          </div>
        )}
      </footer>
    </article>
  );
}
