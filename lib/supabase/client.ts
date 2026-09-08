import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY env vars"
  );
}

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [120, 320];

/**
 * This project's PostgREST intermittently rejects a perfectly valid JWT with
 * `401 PGRST303` ("JWT claims validation or parsing failed"). It hits a
 * different random table each time while sibling requests carrying the byte
 * -for-byte identical token succeed in the same millisecond, and the request
 * never reaches Postgres — so it is not RLS, grants, claims or expiry. Measured
 * at roughly 1 request in 6, which means most page loads lost at least one
 * fetch.
 *
 * Retrying the same request clears it. A 401 is raised at JWT validation before
 * PostgREST touches the database, so nothing was written and replaying a POST
 * is safe. A genuinely expired session still surfaces its 401 after the
 * retries are spent.
 */
async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let response = await fetch(input, init);

  for (let attempt = 0; response.status === 401 && attempt < MAX_RETRIES; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, RETRY_DELAYS_MS[attempt])
    );
    response = await fetch(input, init);
  }

  return response;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithAuthRetry },
});
