import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessState,
  blocksNewCheckout,
  founderSlotsRemaining,
  FOUNDER_SLOT_LIMIT,
  graceEndsAt,
  hasAccess,
  isFounderTierOpen,
  planForPriceId,
  GRACE_DAYS,
} from "./billing.ts";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const daysBefore = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("hasAccess: paying customers", () => {
  it("lets an active subscription in", () => {
    assert.equal(hasAccess({ status: "active" }, NOW), true);
    assert.equal(accessState({ status: "active" }, NOW).reason, "active");
  });

  it("lets a trialing subscription in", () => {
    assert.equal(hasAccess({ status: "trialing" }, NOW), true);
  });

  it("keeps out canceled, unpaid, incomplete and expired", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ]) {
      assert.equal(hasAccess({ status }, NOW), false, `${status} got in`);
    }
  });

  it("keeps out a paused subscription, which holds a price but isn't paying", () => {
    assert.equal(hasAccess({ status: "paused" }, NOW), false);
  });

  it("keeps out a status this build has never heard of", () => {
    // Stripe has added statuses before. An unknown one must fail closed.
    assert.equal(hasAccess({ status: "quantum_superposition" }, NOW), false);
    assert.equal(
      accessState({ status: "quantum_superposition" }, NOW).reason,
      "inactive"
    );
  });
});

describe("hasAccess: comped", () => {
  it("beats having no subscription at all", () => {
    assert.equal(hasAccess({ comped: true }, NOW), true);
    assert.equal(accessState({ comped: true }, NOW).reason, "comped");
  });

  it("beats a canceled subscription", () => {
    assert.equal(hasAccess({ comped: true, status: "canceled" }, NOW), true);
  });

  it("beats an expired grace period", () => {
    assert.equal(
      hasAccess(
        { comped: true, status: "past_due", past_due_since: daysBefore(90) },
        NOW
      ),
      true
    );
  });

  it("false and null are both 'not comped'", () => {
    assert.equal(hasAccess({ comped: false, status: "canceled" }, NOW), false);
    assert.equal(hasAccess({ comped: null, status: "canceled" }, NOW), false);
  });
});

describe("hasAccess: the grace period after a failed payment", () => {
  it("lets them in on day one", () => {
    const sub = { status: "past_due", past_due_since: daysBefore(1) };
    assert.equal(hasAccess(sub, NOW), true);
    assert.equal(accessState(sub, NOW).reason, "grace");
  });

  it("lets them in just inside seven days", () => {
    const sub = { status: "past_due", past_due_since: daysBefore(6.99) };
    assert.equal(hasAccess(sub, NOW), true);
  });

  it("shuts the door just past seven days", () => {
    const sub = { status: "past_due", past_due_since: daysBefore(7.01) };
    assert.equal(hasAccess(sub, NOW), false);
    assert.equal(accessState(sub, NOW).reason, "grace_expired");
  });

  it("treats the boundary itself as expired", () => {
    const sub = { status: "past_due", past_due_since: daysBefore(GRACE_DAYS) };
    assert.equal(hasAccess(sub, NOW), false);
  });

  it("reports when the grace period ends, for the warning banner", () => {
    const since = daysBefore(2);
    const state = accessState({ status: "past_due", past_due_since: since }, NOW);
    assert.deepEqual(state.graceEndsAt, graceEndsAt(since));
    assert.equal(
      state.graceEndsAt!.toISOString(),
      "2026-10-10T12:00:00.000Z"
    );
  });

  it("lets them in when the timestamp is missing, rather than punishing them for our bug", () => {
    assert.equal(hasAccess({ status: "past_due", past_due_since: null }, NOW), true);
    assert.equal(hasAccess({ status: "past_due" }, NOW), true);
  });

  it("lets them in when the timestamp is unparseable", () => {
    assert.equal(
      hasAccess({ status: "past_due", past_due_since: "not a date" }, NOW),
      true
    );
  });
});

describe("hasAccess: nothing there", () => {
  it("refuses a null or undefined row", () => {
    assert.equal(hasAccess(null, NOW), false);
    assert.equal(hasAccess(undefined, NOW), false);
    assert.equal(accessState(null, NOW).reason, "no_subscription");
  });

  it("refuses a row with no status, which is a claim that never completed", () => {
    assert.equal(hasAccess({ comped: false, status: null }, NOW), false);
    assert.equal(accessState({ status: null }, NOW).reason, "no_subscription");
  });
});

describe("a second checkout is refused", () => {
  it("blocks anyone with a subscription that charges them", () => {
    for (const status of ["active", "trialing", "past_due", "paused"]) {
      assert.equal(
        blocksNewCheckout({ status, stripe_subscription_id: "sub_1" }),
        true,
        `${status} was allowed to pay twice`
      );
    }
  });

  it("lets an incomplete first payment be retried", () => {
    // Stripe gives these 23 hours; blocking them would strand them with no way
    // to try again.
    assert.equal(
      blocksNewCheckout({ status: "incomplete", stripe_subscription_id: "sub_1" }),
      false
    );
  });

  it("lets a cancelled customer come back", () => {
    assert.equal(
      blocksNewCheckout({ status: "canceled", stripe_subscription_id: "sub_1" }),
      false
    );
  });

  it("does not block on a status with no subscription behind it", () => {
    // The state right after claim_plan resets a returning customer's row.
    assert.equal(
      blocksNewCheckout({ status: "active", stripe_subscription_id: null }),
      false
    );
    assert.equal(blocksNewCheckout(null), false);
  });
});

describe("founder slots", () => {
  it("counts down from 25", () => {
    assert.equal(FOUNDER_SLOT_LIMIT, 25);
    assert.equal(founderSlotsRemaining(0), 25);
    assert.equal(founderSlotsRemaining(24), 1);
    assert.equal(founderSlotsRemaining(25), 0);
  });

  it("never goes negative, however far the count overshoots", () => {
    assert.equal(founderSlotsRemaining(26), 0);
    assert.equal(founderSlotsRemaining(1000), 0);
  });

  it("treats nonsense as full rather than opening the tier", () => {
    assert.equal(founderSlotsRemaining(Number.NaN), 0);
    assert.equal(founderSlotsRemaining(Number.POSITIVE_INFINITY), 0);
  });

  it("ignores a negative count", () => {
    assert.equal(founderSlotsRemaining(-5), 25);
  });

  it("says whether the tier is open", () => {
    assert.equal(isFounderTierOpen(24), true);
    assert.equal(isFounderTierOpen(25), false);
    assert.equal(isFounderTierOpen(99), false);
  });
});

describe("mapping a Stripe price back to a plan", () => {
  const prices = { founder: "price_founder", standard: "price_standard" };

  it("recognises both configured prices", () => {
    assert.equal(planForPriceId("price_founder", prices), "founder");
    assert.equal(planForPriceId("price_standard", prices), "standard");
  });

  it("returns null for a price this deployment doesn't know", () => {
    assert.equal(planForPriceId("price_something_else", prices), null);
    assert.equal(planForPriceId(null, prices), null);
    assert.equal(planForPriceId(undefined, prices), null);
  });

  it("does not match an unset env var against an unset price", () => {
    // Both undefined must not collapse into a match, or a missing env var
    // would silently price everyone as a founder.
    assert.equal(
      planForPriceId(undefined, { founder: undefined, standard: undefined }),
      null
    );
    assert.equal(
      planForPriceId("price_founder", { founder: undefined, standard: undefined }),
      null
    );
  });
});
