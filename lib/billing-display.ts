/**
 * What the billing page shows. Display only.
 *
 * Nothing here decides access — that is accessState()/hasAccess() in
 * billing.ts, and this module deliberately does not call or change them. These
 * rules only decide which rows and notes the billing page renders, which is why
 * they live apart: a display tweak should never be able to move the paywall.
 *
 * Free of DB, Stripe and UI imports so the rules can be unit-tested.
 */

import { blocksNewCheckout, type AccessInput } from "./billing.ts";

export type DisplayInput = AccessInput & {
  plan?: "founder" | "standard" | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

export type RenewalRow = {
  label: "Next renewal" | "Access ends";
  /** ISO, as stored. The page formats it. */
  date: string;
};

export type CompedNote = "comped_only" | "comped_and_live";

export type BillingDisplay = {
  /** There is a Stripe subscription that exists and is billing. */
  live: boolean;
  showPrice: boolean;
  renewal: RenewalRow | null;
  showCancellingBanner: boolean;
  compedNote: CompedNote | null;
};

/**
 * A Stripe subscription that exists and is charging this customer.
 *
 * The same set that stops a second checkout, on purpose: if we would refuse to
 * sell you another subscription, it is because you already have a live one.
 * One definition, so the two can't drift apart. A row with a live-looking
 * status but no subscription id is not live — that is the state claim_plan
 * leaves a returning customer in mid-checkout.
 */
export function hasLiveSubscription(row: DisplayInput | null | undefined): boolean {
  return blocksNewCheckout(row);
}

export function billingDisplay(row: DisplayInput | null | undefined): BillingDisplay {
  const live = hasLiveSubscription(row);
  const comped = Boolean(row?.comped);
  const plan = row?.plan ?? null;
  const cancelling = Boolean(row?.cancel_at_period_end);
  const periodEnd = row?.current_period_end ?? null;

  // A comped account with nothing behind it in Stripe pays nothing, so a price
  // or a renewal date would be describing a charge that doesn't exist.
  const showPrice = plan !== null && (!comped || live);

  // Only a live subscription has a date worth showing. A cancelled one never
  // renews, so "Next renewal" there would be a promise of a charge that won't
  // come. `paused` is live — it still exists and can't be bought twice — but it
  // won't renew on that date either, so it gets no row.
  let renewal: RenewalRow | null = null;
  if (live && periodEnd && row?.status !== "paused") {
    renewal = cancelling
      ? { label: "Access ends", date: periodEnd }
      : { label: "Next renewal", date: periodEnd };
  }

  return {
    live,
    showPrice,
    renewal,
    // A cancel flag left on a subscription that has already ended is history,
    // not a warning.
    showCancellingBanner: live && cancelling,
    compedNote: comped ? (live ? "comped_and_live" : "comped_only") : null,
  };
}

/**
 * Whether the row now reflects the subscription a just-completed checkout
 * created — the signal to drop the "payment received, may take a few seconds"
 * banner.
 *
 * The subscription id is what the webhook writes; until it is there, the page
 * is still showing the pre-checkout row.
 */
export function checkoutReflected(row: DisplayInput | null | undefined): boolean {
  return Boolean(row?.stripe_subscription_id);
}
