import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accessState, hasAccess } from "./billing.ts";
import {
  billingDisplay,
  checkoutReflected,
  hasLiveSubscription,
  type DisplayInput,
} from "./billing-display.ts";

const PERIOD_END = "2026-11-05T12:00:00.000Z";

const row = (overrides: Partial<DisplayInput> = {}): DisplayInput => ({
  comped: false,
  status: "active",
  stripe_subscription_id: "sub_1",
  plan: "founder",
  current_period_end: PERIOD_END,
  cancel_at_period_end: false,
  past_due_since: null,
  ...overrides,
});

/** What the owner's own account looks like after comp-account.sql. */
const compedOnly = (overrides: Partial<DisplayInput> = {}) =>
  row({
    comped: true,
    status: null,
    stripe_subscription_id: null,
    plan: null,
    current_period_end: null,
    ...overrides,
  });

describe("a comped account with no Stripe subscription", () => {
  const display = billingDisplay(compedOnly());

  it("shows no price", () => {
    assert.equal(display.showPrice, false);
  });

  it("shows no renewal row", () => {
    assert.equal(display.renewal, null);
  });

  it("gets the complimentary-only note", () => {
    assert.equal(display.compedNote, "comped_only");
  });

  it("still shows no price or renewal when a plan and date linger on the row", () => {
    // A former founder, comped after their subscription ended: the plan and
    // the old period end are still stored, but nothing will be charged.
    const lingering = billingDisplay(
      compedOnly({
        plan: "founder",
        status: "canceled",
        stripe_subscription_id: "sub_old",
        current_period_end: PERIOD_END,
      })
    );
    assert.equal(lingering.showPrice, false);
    assert.equal(lingering.renewal, null);
    assert.equal(lingering.compedNote, "comped_only");
  });
});

describe("a comped account that also has a live Stripe subscription", () => {
  const display = billingDisplay(row({ comped: true }));

  it("shows the price they are actually being charged", () => {
    assert.equal(display.showPrice, true);
  });

  it("shows the next renewal", () => {
    assert.deepEqual(display.renewal, { label: "Next renewal", date: PERIOD_END });
  });

  it("gets the 'both' note, not the no-card one", () => {
    assert.equal(display.compedNote, "comped_and_live");
  });

  it("counts past_due as live — they are still being billed", () => {
    const pastDue = billingDisplay(row({ comped: true, status: "past_due" }));
    assert.equal(pastDue.compedNote, "comped_and_live");
    assert.equal(pastDue.showPrice, true);
  });
});

describe("Next renewal is never shown for a subscription that has ended", () => {
  for (const status of ["canceled", "unpaid", "incomplete_expired", "incomplete"]) {
    it(`not for ${status}`, () => {
      assert.equal(billingDisplay(row({ status })).renewal, null);
    });
  }

  it("not for a canceled subscription even with a period end stored", () => {
    const display = billingDisplay(
      row({ status: "canceled", current_period_end: PERIOD_END })
    );
    assert.equal(display.renewal, null);
  });

  it("not for a paused subscription, which won't renew on that date", () => {
    assert.equal(billingDisplay(row({ status: "paused" })).renewal, null);
  });

  it("not for a status this build has never heard of", () => {
    assert.equal(billingDisplay(row({ status: "something_new" })).renewal, null);
  });
});

describe("Access ends", () => {
  it("shows when the subscription is live and set to cancel", () => {
    const display = billingDisplay(row({ cancel_at_period_end: true }));
    assert.deepEqual(display.renewal, { label: "Access ends", date: PERIOD_END });
    assert.equal(display.showCancellingBanner, true);
  });

  it("shows for a live past_due subscription set to cancel", () => {
    const display = billingDisplay(
      row({ status: "past_due", cancel_at_period_end: true })
    );
    assert.equal(display.renewal?.label, "Access ends");
  });

  it("does not show once the subscription has actually been cancelled", () => {
    // Stripe can leave cancel_at_period_end true on the ended subscription.
    const display = billingDisplay(
      row({ status: "canceled", cancel_at_period_end: true })
    );
    assert.equal(display.renewal, null);
    assert.equal(display.showCancellingBanner, false);
  });

  it("does not show without a subscription id behind the status", () => {
    // The state claim_plan leaves a returning customer in mid-checkout.
    const display = billingDisplay(
      row({ stripe_subscription_id: null, cancel_at_period_end: true })
    );
    assert.equal(display.renewal, null);
    assert.equal(display.showCancellingBanner, false);
  });

  it("is replaced by Next renewal when the flag is false", () => {
    assert.equal(billingDisplay(row()).renewal?.label, "Next renewal");
    assert.equal(billingDisplay(row()).showCancellingBanner, false);
  });

  it("gives no row at all when the live subscription has no period end yet", () => {
    assert.equal(billingDisplay(row({ current_period_end: null })).renewal, null);
  });
});

describe("an ordinary paying customer is unchanged", () => {
  it("shows price and next renewal, no comped note", () => {
    const display = billingDisplay(row());
    assert.equal(display.showPrice, true);
    assert.deepEqual(display.renewal, { label: "Next renewal", date: PERIOD_END });
    assert.equal(display.compedNote, null);
  });

  it("still shows the price of a cancelled plan, as before", () => {
    assert.equal(billingDisplay(row({ status: "canceled" })).showPrice, true);
  });

  it("shows nothing for a row with no plan", () => {
    const display = billingDisplay(row({ plan: null, status: null, stripe_subscription_id: null }));
    assert.equal(display.showPrice, false);
    assert.equal(display.renewal, null);
  });

  it("handles no row at all", () => {
    assert.deepEqual(billingDisplay(null), {
      live: false,
      showPrice: false,
      renewal: null,
      showCancellingBanner: false,
      compedNote: null,
    });
  });
});

describe("what counts as a live subscription", () => {
  it("needs both a subscription id and a billing status", () => {
    assert.equal(hasLiveSubscription(row()), true);
    assert.equal(hasLiveSubscription(row({ stripe_subscription_id: null })), false);
    assert.equal(hasLiveSubscription(row({ status: "canceled" })), false);
    assert.equal(hasLiveSubscription(null), false);
  });
});

describe("the payment-received banner", () => {
  it("stays while the row has no subscription yet", () => {
    assert.equal(checkoutReflected(null), false);
    assert.equal(
      checkoutReflected(row({ stripe_subscription_id: null, status: null })),
      false
    );
  });

  it("goes as soon as the webhook has written the subscription", () => {
    assert.equal(checkoutReflected(row()), true);
    assert.equal(checkoutReflected(row({ status: "incomplete" })), true);
  });
});

describe("access is untouched by any of this", () => {
  // Display only. The same rows must open and shut the door exactly as before.
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("comped with nothing in Stripe still has access", () => {
    assert.equal(hasAccess(compedOnly(), now), true);
    assert.equal(accessState(compedOnly(), now).reason, "comped");
  });

  it("comped with a live subscription still has access, as comped", () => {
    assert.equal(accessState(row({ comped: true }), now).reason, "comped");
  });

  it("a live subscription set to cancel still has access until it ends", () => {
    assert.equal(hasAccess(row({ cancel_at_period_end: true }), now), true);
  });

  it("canceled is still shut out, whatever its cancel flag says", () => {
    assert.equal(hasAccess(row({ status: "canceled", cancel_at_period_end: true }), now), false);
  });
});
