"use client";

import type { PricingRule } from "@/lib/supabase/types";
import { formatGBP } from "@/lib/format";

export function PricingSummary({ rule }: { rule: PricingRule | null }) {
  if (!rule) {
    return (
      <section>
        <label>Pricing</label>
        <div className="empty-state">Select a tier to see pricing.</div>
      </section>
    );
  }

  const hasFoundingRate =
    rule.founding_setup_fee != null ||
    rule.founding_monthly_fee != null;

  const setupFee = rule.founding_setup_fee ?? rule.setup_fee;
  const monthlyFee = rule.founding_monthly_fee ?? rule.monthly_fee;

  return (
    <section>
      <label>Pricing</label>
      <div className="pricing-box">
        <div className="pricing-row">
          <span className="pricing-label">Setup fee</span>
          <span className="pricing-value">{formatGBP(setupFee)}</span>
        </div>
        <div className="pricing-row">
          <span className="pricing-label">Monthly fee</span>
          <span className="pricing-value">{formatGBP(monthlyFee)}/mo</span>
        </div>

        {hasFoundingRate && (
          <p className="pricing-note">
            Founding rate — {formatGBP(setupFee)} setup and{" "}
            {formatGBP(monthlyFee)}/mo for the first{" "}
            {rule.founding_duration_months} months. Reverts to{" "}
            {formatGBP(rule.setup_fee)} setup and {formatGBP(rule.monthly_fee)}
            /mo after.
          </p>
        )}
      </div>
    </section>
  );
}
