import { supabase } from "@/lib/supabase/client";

export async function getTiers() {
  const { data, error } = await supabase
    .from("tiers")
    .select("*")
    .order("level");

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
