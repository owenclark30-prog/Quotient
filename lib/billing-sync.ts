/**
 * Deciding what a Stripe subscription event should do to a row.
 *
 * Split out from the route and kept free of Stripe and database imports so the
 * rules — which row an event belongs to, when an event is stale, when the grace
 * clock starts — can be tested directly. The route does the I/O; this decides.
 */

import type { Plan } from "./billing";

/** What the route has read off the Stripe subscription, already normalised. */
export type SubscriptionFacts = {
  id: string;
  customerId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** ISO, from the subscription's items on this API version. */
  currentPeriodEnd: string | null;
  /** Resolved from the price actually being charged, or null if it is a price
   * this deployment doesn't recognise. */
  plan: Plan | null;
};

/** The subset of the row the decision needs. */
export type ExistingRow = {
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string | null;
  plan: Plan | null;
  past_due_since: string | null;
};

export type SubscriptionPatch = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  status: string;
  plan: Plan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  updated_at: string;
};

export type SyncDecision =
  | { action: "ignore"; reason: "no_matching_user" | "stale_subscription" }
  | { action: "apply"; userId: string; patch: SubscriptionPatch };

export function decideSubscriptionSync(
  row: ExistingRow | null,
  facts: SubscriptionFacts,
  now: Date = new Date()
): SyncDecision {
  if (!row) {
    return { action: "ignore", reason: "no_matching_user" };
  }

  // A row that already points at a *different* subscription is a row whose
  // current subscription this event is not about — an old one cancelling after
  // the customer has already started a new one, arriving late.
  //
  // The null case is the one that matters and is easy to get wrong: after
  // claim_plan resets a returning customer, the row's subscription id is null
  // while the new subscription is being created. Those events are exactly the
  // ones that must be accepted, because they are the new subscription
  // announcing itself. Matching on "id differs" alone would reject them and
  // leave the customer paying with no access.
  if (
    row.stripe_subscription_id !== null &&
    row.stripe_subscription_id !== facts.id
  ) {
    return { action: "ignore", reason: "stale_subscription" };
  }

  const nowIso = now.toISOString();

  return {
    action: "apply",
    userId: row.user_id,
    patch: {
      // Never blank out a customer id with a null: it is how the webhook finds
      // this row while a re-claimed subscription id is still null.
      stripe_customer_id: facts.customerId ?? row.stripe_customer_id,
      stripe_subscription_id: facts.id,
      status: facts.status,
      // An unrecognised price leaves the plan as it was rather than nulling it:
      // a missing env var should not silently un-found a founder.
      plan: facts.plan ?? row.plan,
      current_period_end: facts.currentPeriodEnd,
      cancel_at_period_end: facts.cancelAtPeriodEnd,
      // The clock starts on the first past_due event and keeps its original
      // start through every later one, so a run of retries can't extend the
      // grace period indefinitely. Anything else clears it.
      past_due_since:
        facts.status === "past_due" ? (row.past_due_since ?? nowIso) : null,
      updated_at: nowIso,
    },
  };
}

/** The events worth acting on. Anything else is acknowledged and dropped. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}
