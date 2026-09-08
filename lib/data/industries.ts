import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";

export async function getIndustries() {
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getIndustryById(industryId: string) {
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .eq("id", industryId)
    .single();

  if (error) throw error;
  return data;
}

export async function createIndustry(name: string) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("industries")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateIndustry(id: string, name: string) {
  const { error } = await supabase
    .from("industries")
    .update({ name })
    .eq("id", id);

  if (error) throw error;
}

/** Cascades to any industry-specific pricing rules. Saved proposals keep their
 * own snapshot of the industry name. */
export async function deleteIndustry(id: string) {
  const { error } = await supabase.from("industries").delete().eq("id", id);
  if (error) throw error;
}
