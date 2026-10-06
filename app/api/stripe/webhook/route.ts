import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { planForPriceId } from "@/lib/billing";
import {
  decideSubscriptionSync,
  isHandledEvent,
  type ExistingRow,
} from "@/lib/billing-sync";
import {
  idOf,
  periodEndFrom,
  priceIdFrom,
  priceIds,
  stripeClient,
  subscriptionIdFromInvoice,
} from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Node, not edge: signature verification needs the raw body and the Stripe SDK
 * needs Node crypto. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_COLUMNS =
  "user_id, stripe_subscription_id, stripe_customer_id, status, plan, past_due_since";

type Admin = ReturnType<typeof supabaseAdmin>;

/** Thrown for anything that should make Stripe try again. */
class RetryableError extends Error {}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let stripe;
  try {
    stripe = stripeClient();
  } catch (err) {
    console.error("[stripe/webhook] configuration", err);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // The raw body, byte for byte. Parsing it first would change the bytes the
  // signature was computed over and every event would be rejected.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    // A bad signature is not ours to retry: either it isn't from Stripe, or the
    // endpoint secret is wrong. 400 tells Stripe to stop.
    console.error("[stripe/webhook] signature", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let admin: Admin;
  try {
    admin = supabaseAdmin();
  } catch (err) {
    console.error("[stripe/webhook] configuration", err);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Cheap pre-check. The primary key on stripe_events is the real guarantee;
  // this just avoids redoing work for the common duplicate.
  const { data: seen, error: seenError } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (seenError) {
    // A database error here must not be read as "not seen yet" and must not be
    // acknowledged. 500, and Stripe tries again.
    console.error("[stripe/webhook] ledger read", seenError);
    return NextResponse.json({ error: "ledger_unavailable" }, { status: 500 });
  }

  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!isHandledEvent(event.type)) {
    // Acknowledged and recorded, so Stripe stops sending it, but nothing is
    // done. Recording it is still correct: it *has* been processed.
    await recordEvent(admin, event);
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    await handleEvent(stripe, admin, event);
  } catch (err) {
    // Nothing is written to the ledger, so the retry will do the work again.
    // Every write below is idempotent, so doing it twice is harmless; not doing
    // it at all is not.
    console.error(`[stripe/webhook] processing ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  // Only now. Recording before the work would mark an event processed that a
  // failure had thrown away, and Stripe would never send it again.
  const recorded = await recordEvent(admin, event);
  if (!recorded) {
    // The work succeeded but the ledger write didn't. Asking for a retry costs
    // a repeat of idempotent work; the alternative is a ledger that quietly
    // disagrees with reality.
    return NextResponse.json({ error: "ledger_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** True if the event is now recorded — including when a concurrent delivery
 * recorded it first, which is a success, not a conflict. */
async function recordEvent(admin: Admin, event: Stripe.Event): Promise<boolean> {
  const { error } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (!error) return true;
  if (error.code === "23505") return true; // unique violation: already there

  console.error("[stripe/webhook] ledger write", error);
  return false;
}

async function handleEvent(
  stripe: ReturnType<typeof stripeClient>,
  admin: Admin,
  event: Stripe.Event
) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        session.client_reference_id ?? session.metadata?.supabase_user_id ?? null;
      const customerId = idOf(session.customer);

      // Bind the customer to the user before anything else: it is what every
      // later event uses to find this row.
      if (userId && customerId) {
        const { error } = await admin
          .from("subscriptions")
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (error) throw new RetryableError(error.message);
      }

      const subscriptionId = idOf(session.subscription);
      if (subscriptionId) await syncById(stripe, admin, subscriptionId);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncById(stripe, admin, subscription.id);
      break;
    }

    case "invoice.payment_failed":
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      // An invoice with no subscription behind it is a one-off charge, which
      // this product does not have. Nothing to do.
      if (subscriptionId) await syncById(stripe, admin, subscriptionId);
      break;
    }
  }
}

/**
 * Re-read the subscription from Stripe and write what it says.
 *
 * Deliberately not trusting the event payload. Webhooks can arrive out of
 * order — a `deleted` overtaking an `updated` would otherwise leave a live
 * subscription marked cancelled — and the API always returns current state. One
 * extra call per event buys ordering-independence without another column to
 * track it.
 */
async function syncById(
  stripe: ReturnType<typeof stripeClient>,
  admin: Admin,
  subscriptionId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idOf(subscription.customer);
  const userIdHint = subscription.metadata?.supabase_user_id ?? null;

  const row = await findRow(admin, {
    subscriptionId: subscription.id,
    customerId,
    userId: userIdHint,
  });

  const decision = decideSubscriptionSync(row, {
    id: subscription.id,
    customerId,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: periodEndFrom(subscription),
    plan: planForPriceId(priceIdFrom(subscription), priceIds()),
  });

  if (decision.action === "ignore") {
    console.warn(
      `[stripe/webhook] ignoring ${subscription.id}: ${decision.reason}`
    );
    return;
  }

  const { error } = await admin
    .from("subscriptions")
    .update(decision.patch)
    .eq("user_id", decision.userId);

  if (error) throw new RetryableError(error.message);
}

/** By subscription, then by customer, then by the id stamped into metadata at
 * checkout. The second is what carries a re-claimed row, whose subscription id
 * is null until this runs. */
async function findRow(
  admin: Admin,
  keys: {
    subscriptionId: string;
    customerId: string | null;
    userId: string | null;
  }
): Promise<ExistingRow | null> {
  const bySubscription = await admin
    .from("subscriptions")
    .select(ROW_COLUMNS)
    .eq("stripe_subscription_id", keys.subscriptionId)
    .maybeSingle();
  if (bySubscription.error) throw new RetryableError(bySubscription.error.message);
  if (bySubscription.data) return bySubscription.data as ExistingRow;

  if (keys.customerId) {
    const byCustomer = await admin
      .from("subscriptions")
      .select(ROW_COLUMNS)
      .eq("stripe_customer_id", keys.customerId)
      .maybeSingle();
    if (byCustomer.error) throw new RetryableError(byCustomer.error.message);
    if (byCustomer.data) return byCustomer.data as ExistingRow;
  }

  if (keys.userId) {
    const byUser = await admin
      .from("subscriptions")
      .select(ROW_COLUMNS)
      .eq("user_id", keys.userId)
      .maybeSingle();
    if (byUser.error) throw new RetryableError(byUser.error.message);
    if (byUser.data) return byUser.data as ExistingRow;
  }

  return null;
}
