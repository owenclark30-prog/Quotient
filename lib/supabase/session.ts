import { supabase } from "./client";

/** The signed-in user's id, for stamping onto rows we write. RLS enforces
 * this server-side too — this just lets us fill the column. */
export async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not signed in");
  return session.user.id;
}
