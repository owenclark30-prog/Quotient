import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";

export async function getServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}

export async function createService(name: string, description: string | null) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("services")
    .insert({ user_id: userId, name, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateService(
  id: string,
  fields: { name: string; description: string | null }
) {
  const { error } = await supabase.from("services").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}
