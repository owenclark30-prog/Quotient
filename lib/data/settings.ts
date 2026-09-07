import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";

const DEFAULT_AGENCY_NAME = "Your Agency";

export async function getAgencyName() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("settings")
    .select("agency_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  // No row yet means this user hasn't set a name — fall back to the
  // placeholder until they save one.
  return data?.agency_name ?? DEFAULT_AGENCY_NAME;
}

export async function updateAgencyName(agencyName: string) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: userId, agency_name: agencyName });

  if (error) throw error;
}
