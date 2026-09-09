import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";
import { errorMessage } from "@/lib/errors";
import type { AgencyIdentity } from "@/lib/supabase/types";

export const DEFAULT_AGENCY_NAME = "Your Agency";

const EMPTY_IDENTITY: AgencyIdentity = {
  agencyName: DEFAULT_AGENCY_NAME,
  logo: null,
  contactEmail: null,
  website: null,
};

export async function getAgencyIdentity(): Promise<AgencyIdentity> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("settings")
    .select("agency_name, logo, contact_email, website")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  // No row yet means this user hasn't saved anything — fall back to the
  // placeholder name until they do.
  if (!data) return EMPTY_IDENTITY;

  return {
    agencyName: data.agency_name ?? DEFAULT_AGENCY_NAME,
    logo: data.logo,
    contactEmail: data.contact_email,
    website: data.website,
  };
}

/** Never throws. None of this is needed to price anything, so a failure
 * fetching it shouldn't take down a page that works without it. Returns the
 * reason so the caller can warn rather than silently showing the placeholder. */
export async function getAgencyIdentityOrDefault(): Promise<{
  identity: AgencyIdentity;
  warning: string | null;
}> {
  try {
    return { identity: await getAgencyIdentity(), warning: null };
  } catch (err) {
    return {
      identity: EMPTY_IDENTITY,
      warning: errorMessage(err, "Couldn't load your agency details"),
    };
  }
}

/** Blank optional fields are stored as NULL, not "", so "not set" is one value
 * rather than two the proposal has to test for separately. */
export async function updateAgencyIdentity(identity: AgencyIdentity) {
  const userId = await getCurrentUserId();
  const blankToNull = (value: string | null) => value?.trim() || null;

  const { error } = await supabase.from("settings").upsert({
    user_id: userId,
    agency_name: identity.agencyName.trim(),
    logo: identity.logo,
    contact_email: blankToNull(identity.contactEmail),
    website: blankToNull(identity.website),
  });

  if (error) throw error;
}
