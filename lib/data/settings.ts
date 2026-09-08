import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";
import { errorMessage } from "@/lib/errors";

export const DEFAULT_AGENCY_NAME = "Your Agency";

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

/** Never throws. The agency name is the one thing on these pages that isn't
 * needed to price anything, so a failure fetching it shouldn't take down a
 * page that works without it. Returns the reason so the caller can warn
 * rather than silently showing the placeholder. */
export async function getAgencyNameOrDefault() {
  try {
    return { agencyName: await getAgencyName(), warning: null as string | null };
  } catch (err) {
    return {
      agencyName: DEFAULT_AGENCY_NAME,
      warning: errorMessage(err, "Couldn't load your agency name"),
    };
  }
}

export async function updateAgencyName(agencyName: string) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: userId, agency_name: agencyName });

  if (error) throw error;
}
