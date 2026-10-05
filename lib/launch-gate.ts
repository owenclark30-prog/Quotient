/**
 * The pre-launch gate's decision, separated from the Next plumbing that acts on
 * it.
 *
 * Here rather than inline in middleware.ts for one reason: this is the rule
 * that decides whether the whole product is visible, and it should be testable
 * without booting a server. middleware.ts is now the shell that turns a
 * decision into a NextResponse.
 */

export const WAITLIST_PATH = "/waitlist";

/**
 * The one path that stays open while the gate is up.
 *
 * Stripe's webhook has no browser and no session; a redirect to the waitlist is
 * a 307 that Stripe records as a failed delivery. With the gate up and this
 * exemption missing, subscriptions would be paid for and never sync — silently,
 * because nothing in the app would log an error.
 *
 * It is safe to leave open because the route authenticates itself: it verifies
 * a Stripe signature over the raw body before it does anything at all. An
 * unsigned request gets a 400 whether the gate is up or down.
 */
export const WEBHOOK_PATH = "/api/stripe/webhook";

export type GateDecision =
  | { action: "next" }
  | { action: "rewrite"; to: string }
  | { action: "redirect"; to: string };

export function launchGateDecision(
  launchMode: string | undefined,
  pathname: string
): GateDecision {
  // Fail open: only the exact string raises the gate. Unset, mistyped, or
  // anything else runs the app as normal — losing an env var should not hide
  // the whole product behind a signup form.
  if (launchMode !== "waitlist") return { action: "next" };

  // The webhook, before anything else.
  if (pathname === WEBHOOK_PATH) return { action: "next" };

  // Serve the waitlist itself, or the gate would redirect to itself forever.
  if (pathname === WAITLIST_PATH) return { action: "next" };

  // Rewrite rather than redirect, so the waitlist is what "/" actually is.
  if (pathname === "/") return { action: "rewrite", to: WAITLIST_PATH };

  // Everything else — /login, /rate-card, /onboarding/* — goes to the front
  // door. The whole app is sealed while the gate is up.
  return { action: "redirect", to: "/" };
}
