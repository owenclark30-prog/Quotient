import { supabase } from "@/lib/supabase/client";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_AGENCY_NAME = "Your Agency";

export async function getAgencyName() {
  const { data, error } = await supabase
    .from("settings")
    .select("agency_name")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.agency_name ?? DEFAULT_AGENCY_NAME;
}

export async function updateAgencyName(agencyName: string) {
  const { error } = await supabase
    .from("settings")
    .upsert({ id: SETTINGS_ID, agency_name: agencyName });

  if (error) throw error;
}
