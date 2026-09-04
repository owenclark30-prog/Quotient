import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ProposalInsert = Database["public"]["Tables"]["proposals"]["Insert"];

export async function createProposal(proposal: ProposalInsert) {
  const { data, error } = await supabase
    .from("proposals")
    .insert(proposal)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProposals() {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
