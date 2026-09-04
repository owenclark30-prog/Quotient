import { supabase } from "@/lib/supabase/client";

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
