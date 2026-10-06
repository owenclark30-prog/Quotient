import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findBlockingSubscription,
  STRIPE_BLOCKING_STATUSES,
  type ListedSubscription,
  type SubscriptionLister,
} from "./billing-checkout.ts";

type Call = Parameters<SubscriptionLister["subscriptions"]["list"]>[0];

/** A fake Stripe client that serves canned pages and records what it was asked. */
function mockStripe(pages: { data: ListedSubscription[]; has_more: boolean }[]) {
  const calls: Call[] = [];
  const client: SubscriptionLister = {
    subscriptions: {
      async list(params) {
        calls.push(params);
        const page = pages[calls.length - 1];
        if (!page) throw new Error("mock: asked for more pages than it has");
        return page;
      },
    },
  };
  return { client, calls };
}

/** A Stripe client whose API call fails, as on a network error or bad key. */
function failingStripe(message: string): SubscriptionLister {
  return {
    subscriptions: {
      async list() {
        throw new Error(message);
      },
    },
  };
}

const sub = (id: string, status: string): ListedSubscription => ({ id, status });

describe("the Stripe-side double-subscription guard", () => {
  it("lets a customer with no subscriptions through", async () => {
    const { client } = mockStripe([{ data: [], has_more: false }]);
    assert.equal(await findBlockingSubscription(client, "cus_1"), null);
  });

  for (const status of ["active", "trialing", "past_due", "incomplete"]) {
    it(`refuses when the customer already has one that is ${status}`, async () => {
      const { client } = mockStripe([
        { data: [sub("sub_live", status)], has_more: false },
      ]);
      assert.deepEqual(await findBlockingSubscription(client, "cus_1"), {
        id: "sub_live",
        status,
      });
    });
  }

  it("refuses for the webhook-lag window: paid in Stripe, not yet in our row", async () => {
    // The case this exists for. Checkout has just created an active
    // subscription; the database doesn't know yet. Stripe does.
    const { client } = mockStripe([
      { data: [sub("sub_just_paid", "active")], has_more: false },
    ]);
    const found = await findBlockingSubscription(client, "cus_returning");
    assert.equal(found?.id, "sub_just_paid");
  });

  for (const status of ["canceled", "incomplete_expired", "unpaid", "paused"]) {
    it(`does not count a ${status} subscription`, async () => {
      const { client } = mockStripe([
        { data: [sub("sub_old", status)], has_more: false },
      ]);
      assert.equal(await findBlockingSubscription(client, "cus_1"), null);
    });
  }

  it("finds a live one among old cancelled ones", async () => {
    const { client } = mockStripe([
      {
        data: [
          sub("sub_a", "canceled"),
          sub("sub_b", "incomplete_expired"),
          sub("sub_c", "past_due"),
        ],
        has_more: false,
      },
    ]);
    assert.equal((await findBlockingSubscription(client, "cus_1"))?.id, "sub_c");
  });

  it("asks Stripe for every status of this customer only", async () => {
    // `all`, because Stripe's default list silently omits canceled ones —
    // the filtering rule should live in one place, here.
    const { client, calls } = mockStripe([{ data: [], has_more: false }]);
    await findBlockingSubscription(client, "cus_42");
    assert.deepEqual(calls, [{ customer: "cus_42", status: "all", limit: 100 }]);
  });

  it("pages through when Stripe says there is more", async () => {
    const { client, calls } = mockStripe([
      { data: [sub("sub_1", "canceled"), sub("sub_2", "canceled")], has_more: true },
      { data: [sub("sub_3", "active")], has_more: false },
    ]);
    assert.equal((await findBlockingSubscription(client, "cus_1"))?.id, "sub_3");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].starting_after, "sub_2");
  });

  it("stops at the last page", async () => {
    const { client, calls } = mockStripe([
      { data: [sub("sub_1", "canceled")], has_more: true },
      { data: [sub("sub_2", "canceled")], has_more: false },
    ]);
    assert.equal(await findBlockingSubscription(client, "cus_1"), null);
    assert.equal(calls.length, 2);
  });

  it("does not loop forever on a response that claims more but returns nothing", async () => {
    const { client, calls } = mockStripe([{ data: [], has_more: true }]);
    assert.equal(await findBlockingSubscription(client, "cus_1"), null);
    assert.equal(calls.length, 1);
  });

  it("throws when Stripe can't be asked, so the route can refuse rather than sell", async () => {
    // Failing open here would be exactly the double charge this prevents.
    await assert.rejects(
      findBlockingSubscription(failingStripe("api_connection_error"), "cus_1"),
      /api_connection_error/
    );
  });

  it("blocks on exactly the four statuses specified", () => {
    assert.deepEqual(
      [...STRIPE_BLOCKING_STATUSES],
      ["active", "trialing", "past_due", "incomplete"]
    );
  });
});
