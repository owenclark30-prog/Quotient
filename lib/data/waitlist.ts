import { supabase } from "@/lib/supabase/client";

/** Postgres unique-violation. Someone signing up twice is not an error worth
 * showing them. */
const UNIQUE_VIOLATION = "23505";

/**
 * Adds an address to the waitlist.
 *
 * Deliberately no `.select()` after the insert: `anon` has INSERT and nothing
 * else, so asking for the row back would fail on a policy that doesn't exist.
 *
 * A duplicate resolves as success rather than an error. That is better for the
 * person signing up, and it means the form can't be used to find out who is
 * already on the list.
 */
export async function joinWaitlist(email: string, name: string) {
  const trimmedName = name.trim();

  const { error } = await supabase.from("waitlist_emails").insert({
    email: email.trim().toLowerCase(),
    name: trimmedName || null,
  });

  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}
