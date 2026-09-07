/** supabase-js returns PostgrestError as a plain object, not an Error, so
 * `err instanceof Error` silently discards the useful part. Pull out message,
 * code and hint from either shape — Postgres often puts the actual fix in
 * `hint`. */
export function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object") {
    const { message, code, hint } = err as {
      message?: unknown;
      code?: unknown;
      hint?: unknown;
    };

    if (typeof message === "string" && message) {
      return [
        typeof code === "string" && code ? `[${code}]` : null,
        message,
        typeof hint === "string" && hint ? `— ${hint}` : null,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  return fallback;
}
