import { supabase } from "@/lib/supabase/client";

export async function getIndustries() {
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .order("name");

  if (error) throw error;
  return data;
}
