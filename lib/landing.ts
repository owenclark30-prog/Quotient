/**
 * The public landing page's two small decisions, kept out of the components so
 * they can be tested without a browser.
 */

export type LandingMode = "waitlist" | "live";

/**
 * Which landing to render. The same rule as the launch gate in
 * lib/launch-gate.ts: only the exact string "waitlist" raises it, and anything
 * else, unset included, is live. If the two ever disagreed, the page would offer
 * a sign-up the gate then bounces, or a waitlist for an app that is open.
 */
export function landingMode(launchMode: string | undefined): LandingMode {
  return launchMode === "waitlist" ? "waitlist" : "live";
}

/** Where a live "Claim a founder spot" goes: create an account, then pay. */
export const SIGNUP_PATH = "/login?mode=signup&next=/subscribe";

/**
 * A `next` query value made safe to redirect to after sign-in.
 *
 * Only a same-site path is allowed. "//evil.example" and "/\evil.example" are
 * read by browsers as another host, so both fall back, as does anything that
 * isn't a path at all. Without this, a crafted sign-in link would hand a fresh
 * session straight to somebody else's page.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
