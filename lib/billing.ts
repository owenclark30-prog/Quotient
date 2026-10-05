/**
 * Billing: who has access, and what the founder tier costs.
 *
 * TEST MODE throughout. Stripe is the source of truth for money; this module is
 * the rules the app applies to the local cache of it.
 *
 * Deliberately free of DB, Stripe and UI imports, like lib/pricing.ts: these are
 * the decisions that decide whether someone gets into the product, so they are
 * unit-testable without a network or a database.
 */

/** Mirrors founder_slot_limit() in migration 0018. Kept in step by hand; the
 * server route reads the real count from the database, never from here. */
export const FOUNDER_SLOT_LIMIT = 25;

/** How long a failed payment buys before the door closes. */
export const GRACE_DAYS = 7;

export type Plan = "founder" | "standard";

/** Display only. Stripe's prices are what actually get charged — these two
 * numbers exist so the UI can say "£29/mo" without a round trip, and they are
 * wrong the moment someone edits a price in the Stripe dashboard. */
export const PLAN_PRICE_LABEL: Record<Plan, string> = {
  founder: "£29/mo",
  standard: "£39/mo",
};

export const PLAN_LABEL: Record<Plan, string> = {
  founder: "Founder",
  standard: "Standard",
};

/** Statuses that mean the subscription is working and paid. */
export const ACTIVE_STATUSES = ["active", "trialing"] as const;

/**
 * Statuses that stop someone starting a *new* checkout, because they already
 * have a subscription that charges them.
 *
 * `incomplete` is deliberately absent: it means the first payment hasn't landed
 * yet, and blocking those people would strand them with no way to retry.
 *
 * `paused` is here but not in ACTIVE_STATUSES — a paused subscription still
 * exists and must not be bought twice, but it is not paying, so it does not
 * open the door. Holding a price and having access are different questions.
 */
export const BLOCKS_NEW_CHECKOUT = [
  "active",
  "trialing",
  "past_due",
  "paused",
] as const;

/** The fields the access rules read. A database row satisfies this, and so does
 * a test fixture — nothing here needs a full row. */
export type AccessInput = {
  comped?: boolean | null;
  status?: string | null;
  past_due_since?: string | null;
  stripe_subscription_id?: string | null;
};

export type AccessReason =
  | "comped"
  | "active"
  | "grace"
  | "no_subscription"
  | "grace_expired"
  | "inactive";

export type AccessState = {
  allowed: boolean;
  reason: AccessReason;
  /** When the grace period runs out, for the banner that warns about it. Null
   * unless the reason is `grace`. */
  graceEndsAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** When a past_due subscription stops buying time. */
export function graceEndsAt(pastDueSince: string | null | undefined): Date | null {
  const started = parseDate(pastDueSince);
  return started ? new Date(started.getTime() + GRACE_DAYS * DAY_MS) : null;
}

/**
 * The whole access rule, with its reasoning, so the UI can explain itself
 * rather than just locking the door.
 */
export function accessState(
  subscription: AccessInput | null | undefined,
  now: Date = new Date()
): AccessState {
  if (!subscription) {
    return { allowed: false, reason: "no_subscription", graceEndsAt: null };
  }

  // Comped first, and it beats everything. This is the flag that lets the owner
  // and anyone being comped in regardless of what Stripe thinks — including
  // when Stripe has never heard of them.
  if (subscription.comped) {
    return { allowed: true, reason: "comped", graceEndsAt: null };
  }

  const status = subscription.status ?? null;

  if (status && (ACTIVE_STATUSES as readonly string[]).includes(status)) {
    return { allowed: true, reason: "active", graceEndsAt: null };
  }

  if (status === "past_due") {
    const ends = graceEndsAt(subscription.past_due_since);

    // No timestamp means the webhook that should have set it hasn't landed, or
    // failed. Let them in: the grace period exists precisely so a payment
    // problem doesn't lock someone out mid-work, and a missing timestamp is our
    // bug, not theirs. The next webhook sets it and the clock starts properly.
    if (!ends) return { allowed: true, reason: "grace", graceEndsAt: null };

    return now < ends
      ? { allowed: true, reason: "grace", graceEndsAt: ends }
      : { allowed: false, reason: "grace_expired", graceEndsAt: ends };
  }

  if (!status) {
    return { allowed: false, reason: "no_subscription", graceEndsAt: null };
  }

  // canceled, unpaid, incomplete, incomplete_expired, paused, and anything
  // Stripe adds later that this build has never heard of.
  return { allowed: false, reason: "inactive", graceEndsAt: null };
}

/** comped, or paying, or inside the grace period after a failed payment. */
export function hasAccess(
  subscription: AccessInput | null | undefined,
  now: Date = new Date()
): boolean {
  return accessState(subscription, now).allowed;
}

/**
 * Whether this row already has a subscription that charges them, in which case
 * checkout must send them to the billing portal instead of selling them a
 * second one.
 *
 * Mirrors the backstop inside claim_plan(); the database is the one that
 * actually enforces it, this just gives a better answer than a silent no-op.
 */
export function blocksNewCheckout(
  subscription: AccessInput | null | undefined
): boolean {
  if (!subscription?.stripe_subscription_id) return false;
  const status = subscription.status ?? null;
  return (
    status !== null && (BLOCKS_NEW_CHECKOUT as readonly string[]).includes(status)
  );
}

/** Never negative, however the count and the limit drift apart. */
export function founderSlotsRemaining(
  used: number,
  limit: number = FOUNDER_SLOT_LIMIT
): number {
  if (!Number.isFinite(used)) return 0;
  return Math.max(0, Math.min(limit, limit - Math.max(0, Math.trunc(used))));
}

export function isFounderTierOpen(
  used: number,
  limit: number = FOUNDER_SLOT_LIMIT
): boolean {
  return founderSlotsRemaining(used, limit) > 0;
}

/** Which plan a Stripe price id corresponds to. Returns null for a price this
 * deployment doesn't recognise, which is a configuration problem rather than
 * something to guess at. */
export function planForPriceId(
  priceId: string | null | undefined,
  prices: { founder: string | undefined; standard: string | undefined }
): Plan | null {
  if (!priceId) return null;
  if (prices.founder && priceId === prices.founder) return "founder";
  if (prices.standard && priceId === prices.standard) return "standard";
  return null;
}
