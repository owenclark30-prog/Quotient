import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * The service-role Supabase client. SERVER CODE ONLY.
 *
 * This key bypasses RLS entirely. It must never be imported from a client
 * component, and its value must never reach the bundle — which is why it is
 * read from `SUPABASE_SERVICE_ROLE_KEY` and not from anything prefixed
 * NEXT_PUBLIC_. Next inlines NEXT_PUBLIC_* into the browser bundle; everything
 * else stays on the server.
 *
 * Built per request rather than at module scope so a missing env var fails the
 * one route that needs it with a clear message, instead of taking down every
 * page that happens to import the module.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — billing routes cannot read or write subscriptions without it"
    );
  }

  return createClient<Database>(url, key, {
    // No session to persist and nothing to refresh: this client is one request
    // long and authenticates with a static key.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The signed-in user behind a request, or null.
 *
 * The browser sends its Supabase access token as a bearer header; this verifies
 * it against Supabase rather than trusting anything in the body. A route that
 * took a user id from the request would let anyone subscribe, or open a billing
 * portal, as anyone else.
 *
 * Deliberately uses the publishable key, not the service role. Validating a JWT
 * needs no privilege whatsoever, and using the secret here would mean a missing
 * or mistyped service key turned "your token is invalid" into an opaque 500 —
 * which is exactly what the smoke test caught.
 *
 * Returns null for every failure. There is no distinction worth drawing between
 * an expired token, a forged one and a Supabase outage: none of them is a
 * signed-in user, and saying which is which only helps someone probing.
 */
export async function userFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    const { data, error } = await createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.getUser(token);

    return error || !data.user ? null : data.user;
  } catch {
    return null;
  }
}
