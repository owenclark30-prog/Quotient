/**
 * The Stripe-side guard against selling someone a second subscription.
 *
 * The database check in the checkout route is fast but can lag: after someone
 * pays, Stripe redirects them back before the webhook has written the
 * subscription to our row, and for those few seconds the row looks like a
 * customer who has never paid. A second click on Subscribe in that window would
 * be sold a second subscription. Stripe itself has no such lag — Checkout
 * creates the subscription before it redirects — so asking Stripe closes the
 * window the database can't.
 *
 * Takes the narrowest possible slice of the Stripe client, so the test can hand
 * it a fake and the module has no Stripe import of its own.
 */

/**
 * Statuses that mean the customer already has a subscription we would be
 * duplicating.
 *
 * `incomplete` is included here even though the database check lets it through:
 * it is also the state a subscription is in while its first payment is still
 * settling, which is exactly the window this guard exists for. The cost is that
 * someone whose first payment is genuinely stuck is sent to the portal rather
 * than to a fresh checkout until Stripe expires the attempt (23 hours).
 */
export const STRIPE_BLOCKING_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
] as const;

export type ListedSubscription = { id: string; status: string };

type ListParams = {
  customer: string;
  status: "all";
  limit: number;
  starting_after?: string;
};

export type SubscriptionLister = {
  subscriptions: {
    list(params: ListParams): Promise<{
      data: ListedSubscription[];
      has_more: boolean;
    }>;
  };
};

const PAGE_SIZE = 100;
/** A customer with more than a thousand subscriptions is not a customer this
 * guard needs to page through to the end; stop rather than loop forever on a
 * misbehaving response. */
const MAX_PAGES = 10;

/**
 * The first subscription on this Stripe customer that a new checkout would
 * duplicate, or null if there is none.
 *
 * Throws if Stripe can't be asked. The caller must treat that as "don't sell":
 * failing open here is exactly the double charge this exists to prevent.
 */
export async function findBlockingSubscription(
  stripe: SubscriptionLister,
  customerId: string
): Promise<ListedSubscription | null> {
  const blocking = STRIPE_BLOCKING_STATUSES as readonly string[];
  let startingAfter: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    // `all` rather than Stripe's default, which silently leaves out canceled.
    // Leaving filtering to this list means the rule is written in one place.
    const response = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: PAGE_SIZE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const found = response.data.find((sub) => blocking.includes(sub.status));
    if (found) return found;

    const last = response.data[response.data.length - 1];
    if (!response.has_more || !last) return null;
    startingAfter = last.id;
  }

  return null;
}
