import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";
import type { Database } from "@/lib/supabase/types";

type ProposalInsert = Database["public"]["Tables"]["proposals"]["Insert"];

export async function createProposal(
  proposal: Omit<ProposalInsert, "user_id">
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...proposal, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProposalById(id: string) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/** Only the columns the list and dashboard actually render. Deliberately not
 * `*`: agency_logo is an inlined image, and fetching one per row would make
 * this query grow with every proposal ever saved. */
export async function getProposals() {
  const { data, error } = await supabase
    .from("proposals")
    .select("id, client_name, tier_name, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
