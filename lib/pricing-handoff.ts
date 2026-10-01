import {
  parsePricingSnapshot,
  type PricingSnapshot,
} from "@/lib/pricing-snapshot";

/** What the pricing step hands to the proposal page.
 *
 * `fees` null means the agency priced the client but kept its rate card fees,
 * which is a real answer and not the same as skipping the step. */
export type PricingHandoff = {
  snapshot: PricingSnapshot;
  fees: { setup_fee: number; monthly_fee: number } | null;
};

const PREFIX = "quotient:pricing:";

/** Stashed in sessionStorage and referenced by key in the URL, rather than
 * carried in the query string: a snapshot is far too big for a URL, and a fee
 * the agency settled on shouldn't be editable in the address bar.
 *
 * Returns null if storage is unavailable (private mode, blocked site data). The
 * caller carries on without a key — the proposal is still correct, it just
 * prices from the rate card and shows no expected return. */
export function stashPricing(handoff: PricingHandoff): string | null {
  try {
    const key = crypto.randomUUID();
    sessionStorage.setItem(PREFIX + key, JSON.stringify(handoff));
    return key;
  } catch {
    return null;
  }
}

/** Null for a key that has expired, was never written, or holds something this
 * build doesn't recognise. */
export function readPricing(key: string): PricingHandoff | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PricingHandoff>;
    const snapshot = parsePricingSnapshot(parsed?.snapshot);
    if (!snapshot) return null;

    const fees = parsed.fees;
    const valid =
      fees == null ||
      (typeof fees.setup_fee === "number" &&
        Number.isFinite(fees.setup_fee) &&
        typeof fees.monthly_fee === "number" &&
        Number.isFinite(fees.monthly_fee));

    return valid ? { snapshot, fees: fees ?? null } : null;
  } catch {
    return null;
  }
}

/** Called once the snapshot is safely frozen onto the proposal row, so a stale
 * key can't attach the same pricing to a second proposal. */
export function clearPricing(key: string) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do: the key is already unreachable.
  }
}
