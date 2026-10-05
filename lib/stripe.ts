import Stripe from "stripe";

/**
 * The Stripe client, and the bits of configuration around it. SERVER ONLY.
 *
 * TEST MODE: STRIPE_SECRET_KEY is an sk_test_ key and the price ids are
 * test-mode prices. Nothing here is guarded against being pointed at live keys,
 * because nothing here should be.
 */

/**
 * Pinned, not left to drift with the SDK.
 *
 * This version matters more than usual. On it, `current_period_end` is no
 * longer a field on the Subscription object — it lives on each subscription
 * item — and `invoice.subscription` has moved to
 * `invoice.parent.subscription_details.subscription`. Code below reads both
 * from their current homes. An SDK upgrade that silently moved the pin would
 * start writing nulls into the database rather than failing loudly.
 */
export const STRIPE_API_VERSION = "2026-09-30.endive";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    appInfo: { name: "Quotient" },
  });
}

/** The two configured price ids, as a pair. Either may be undefined; the caller
 * decides whether the one it needs is missing. */
export function priceIds() {
  return {
    founder: process.env.STRIPE_PRICE_FOUNDER,
    standard: process.env.STRIPE_PRICE_STANDARD,
  };
}

/** Stripe returns an id or an expanded object almost everywhere. */
export function idOf(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * The end of the period the current payment covers.
 *
 * On this API version the subscription itself has no `current_period_end`; each
 * item carries its own. For a single flat monthly price there is exactly one
 * item, so this is that item's value. Taking the maximum is the conservative
 * reading for an access deadline: access lasts until the last period paid for.
 */
export function periodEndFrom(subscription: Stripe.Subscription): string | null {
  const ends = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number" && end > 0);

  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

/** The price id a subscription is actually being charged on. */
export function priceIdFrom(subscription: Stripe.Subscription): string | null {
  return idOf(subscription.items?.data?.[0]?.price);
}

/**
 * The subscription an invoice belongs to.
 *
 * `invoice.subscription` was removed on this API version; the link now hangs
 * off `parent`, which is null for invoices that no subscription generated.
 */
export function subscriptionIdFromInvoice(
  invoice: Stripe.Invoice
): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}
