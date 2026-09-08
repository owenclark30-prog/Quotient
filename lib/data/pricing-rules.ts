import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";

/**
 * Returns the pricing rule for a tier, preferring an industry-specific rule
 * over the generic (industry_id IS NULL) fallback.
 */
export async function getPricingRule(tierId: string, industryId?: string | null) {
  if (industryId) {
    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("tier_id", tierId)
      .eq("industry_id", industryId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("tier_id", tierId)
    .is("industry_id", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getPricingRules() {
  const { data, error } = await supabase.from("pricing_rules").select("*");

  if (error) throw error;
  return data;
}

export type PricingFees = {
  setup_fee: number;
  monthly_fee: number;
  founding_setup_fee: number | null;
  founding_monthly_fee: number | null;
  founding_duration_months: number | null;
};

/** Writes the generic (industry_id IS NULL) rule for a tier. A partial unique
 * index allows only one per tier, so update in place when one exists rather
 * than relying on upsert conflict targets. */
export async function saveGenericPricingRule(
  tierId: string,
  existingRuleId: string | null,
  fees: PricingFees
) {
  if (existingRuleId) {
    const { error } = await supabase
      .from("pricing_rules")
      .update(fees)
      .eq("id", existingRuleId);

    if (error) throw error;
    return;
  }

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("pricing_rules")
    .insert({ user_id: userId, tier_id: tierId, industry_id: null, ...fees });

  if (error) throw error;
}
