import { supabase } from "@/lib/supabase/client";

export async function getServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}
