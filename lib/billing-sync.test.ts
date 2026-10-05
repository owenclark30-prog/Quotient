import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideSubscriptionSync,
  isHandledEvent,
  HANDLED_EVENTS,
  type ExistingRow,
  type SubscriptionFacts,
} from "./billing-sync.ts";

const NOW = new Date("2026-10-05T12:00:00.000Z");

const row = (overrides: Partial<ExistingRow> = {}): ExistingRow => ({
  user_id: "user-1",
  stripe_subscription_id: "sub_current",
  stripe_customer_id: "cus_1",
  status: "active",
  plan: "founder",
  past_due_since: null,
  ...overrides,
});

const facts = (overrides: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  id: "sub_current",
  customerId: "cus_1",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-11-05T12:00:00.000Z",
  plan: "founder",
  ...overrides,
});

describe("which events belong to which row", () => {
  it("ignores an event with no row behind it", () => {
    const decision = decideSubscriptionSync(null, facts(), NOW);
    assert.deepEqual(decision, { action: "ignore", reason: "no_matching_user" });
  });

  it("applies an event for the subscription the row already points at", () => {
    const decision = decideSubscriptionSync(row(), facts(), NOW);
    assert.equal(decision.action, "apply");
  });
});

describe("stale events about a replaced subscription", () => {
  it("ignores one when the row points at a different subscription", () => {
    // The old subscription cancelling, arriving after the new one is live.
    const decision = decideSubscriptionSync(
      row({ stripe_subscription_id: "sub_new" }),
      facts({ id: "sub_old", status: "canceled" }),
      NOW
    );
    assert.deepEqual(decision, {
      action: "ignore",
      reason: "stale_subscription",
    });
  });

  it("ACCEPTS one when the row's subscription id is null after a re-claim", () => {
    // The case that matters: claim_plan has just reset a returning customer's
    // row, so the id is null and the new subscription is announcing itself.
    // Rejecting this would leave them paying with no access.
    const decision = decideSubscriptionSync(
      row({ stripe_subscription_id: null, status: null, past_due_since: null }),
      facts({ id: "sub_brand_new" }),
      NOW
    );

    assert.equal(decision.action, "apply");
    assert.equal(
      decision.action === "apply" && decision.patch.stripe_subscription_id,
      "sub_brand_new"
    );
  });

  it("accepts a null-id row even when the event is for a subscription it once had", () => {
    const decision = decideSubscriptionSync(
      row({ stripe_subscription_id: null }),
      facts({ id: "sub_old" }),
      NOW
    );
    assert.equal(decision.action, "apply");
  });

  it("is the id that decides, not the status", () => {
    // A canceled event for the row's *current* subscription is not stale — it
    // is how a row learns it has been cancelled.
    const decision = decideSubscriptionSync(
      row({ stripe_subscription_id: "sub_current" }),
      facts({ id: "sub_current", status: "canceled" }),
      NOW
    );
    assert.equal(decision.action, "apply");
    assert.equal(decision.action === "apply" && decision.patch.status, "canceled");
  });
});

describe("the past_due clock", () => {
  it("starts on the first past_due event", () => {
    const decision = decideSubscriptionSync(
      row({ past_due_since: null }),
      facts({ status: "past_due" }),
      NOW
    );
    assert.equal(
      decision.action === "apply" && decision.patch.past_due_since,
      NOW.toISOString()
    );
  });

  it("keeps its original start through later past_due events", () => {
    // Otherwise each retry would reset the clock and the grace period would
    // never end.
    const original = "2026-10-01T09:00:00.000Z";
    const decision = decideSubscriptionSync(
      row({ past_due_since: original }),
      facts({ status: "past_due" }),
      NOW
    );
    assert.equal(
      decision.action === "apply" && decision.patch.past_due_since,
      original
    );
  });

  it("clears when the payment recovers", () => {
    const decision = decideSubscriptionSync(
      row({ past_due_since: "2026-10-01T09:00:00.000Z" }),
      facts({ status: "active" }),
      NOW
    );
    assert.equal(decision.action === "apply" && decision.patch.past_due_since, null);
  });

  it("clears on cancellation too", () => {
    const decision = decideSubscriptionSync(
      row({ past_due_since: "2026-10-01T09:00:00.000Z" }),
      facts({ status: "canceled" }),
      NOW
    );
    assert.equal(decision.action === "apply" && decision.patch.past_due_since, null);
  });
});

describe("what the patch preserves", () => {
  it("keeps the stored customer id when the event carries none", () => {
    const decision = decideSubscriptionSync(
      row({ stripe_customer_id: "cus_kept" }),
      facts({ customerId: null }),
      NOW
    );
    assert.equal(
      decision.action === "apply" && decision.patch.stripe_customer_id,
      "cus_kept"
    );
  });

  it("keeps the existing plan when the price is one this build doesn't know", () => {
    // A missing or mistyped price env var must not silently un-found a founder.
    const decision = decideSubscriptionSync(
      row({ plan: "founder" }),
      facts({ plan: null }),
      NOW
    );
    assert.equal(decision.action === "apply" && decision.patch.plan, "founder");
  });

  it("takes the plan from the price actually being charged", () => {
    const decision = decideSubscriptionSync(
      row({ plan: "founder" }),
      facts({ plan: "standard" }),
      NOW
    );
    assert.equal(decision.action === "apply" && decision.patch.plan, "standard");
  });

  it("carries the period end and the cancel flag through", () => {
    const decision = decideSubscriptionSync(
      row(),
      facts({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-12-01T00:00:00.000Z" }),
      NOW
    );
    assert.equal(decision.action === "apply" && decision.patch.cancel_at_period_end, true);
    assert.equal(
      decision.action === "apply" && decision.patch.current_period_end,
      "2026-12-01T00:00:00.000Z"
    );
  });

  it("accepts a null period end rather than inventing one", () => {
    const decision = decideSubscriptionSync(row(), facts({ currentPeriodEnd: null }), NOW);
    assert.equal(decision.action === "apply" && decision.patch.current_period_end, null);
  });
});

describe("the handled event list", () => {
  it("covers exactly the six events the webhook is registered for", () => {
    assert.deepEqual([...HANDLED_EVENTS], [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
      "invoice.paid",
    ]);
  });

  it("recognises them and nothing else", () => {
    assert.equal(isHandledEvent("invoice.paid"), true);
    assert.equal(isHandledEvent("customer.subscription.trial_will_end"), false);
    assert.equal(isHandledEvent("payment_intent.succeeded"), false);
  });
});
