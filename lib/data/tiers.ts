import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";

export async function getTiers() {
  const { data, error } = await supabase
    .from("tiers")
    .select("*")
    .order("level");

  if (error) throw error;
  return data;
}

export async function getTierById(tierId: string) {
  const { data, error } = await supabase
    .from("tiers")
    .select("*")
    .eq("id", tierId)
    .single();

  if (error) throw error;
  return data;
}

export async function getTierWithServices(tierId: string) {
  const { data, error } = await supabase
    .from("tier_services")
    .select("service_id, services(*)")
    .eq("tier_id", tierId);

  if (error) throw error;
  return data;
}

/** Levels are per-user sort order; a new tier goes on the end. */
export async function createTier(
  name: string,
  description: string | null,
  level: number
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("tiers")
    .insert({ user_id: userId, name, description, level })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTier(
  id: string,
  fields: { name: string; description: string | null; level: number }
) {
  const { error } = await supabase.from("tiers").update(fields).eq("id", id);
  if (error) throw error;
}

/** Cascades to that tier's tier_services and pricing_rules. Saved proposals
 * are unaffected — they hold their own snapshot. */
export async function deleteTier(id: string) {
  const { error } = await supabase.from("tiers").delete().eq("id", id);
  if (error) throw error;
}

export async function getAllTierServices() {
  const { data, error } = await supabase
    .from("tier_services")
    .select("tier_id, service_id");

  if (error) throw error;
  return data;
}

export async function addServiceToTier(tierId: string, serviceId: string) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("tier_services")
    .insert({ user_id: userId, tier_id: tierId, service_id: serviceId });

  if (error) throw error;
}

export async function removeServiceFromTier(tierId: string, serviceId: string) {
  const { error } = await supabase
    .from("tier_services")
    .delete()
    .eq("tier_id", tierId)
    .eq("service_id", serviceId);

  if (error) throw error;
}
