import { NextResponse } from "next/server";
import { blocksNewCheckout } from "@/lib/billing";
import { requestOrigin } from "@/lib/request-origin";
import { idOf, priceIds, stripeClient } from "@/lib/stripe";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase/admin";

/** Stripe's SDK and the service-role key both need Node, not the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe's minimum. The founder claim holds for 45 minutes (migration 0018),
 * which leaves 15 minutes of slack for a webhook arriving after a session that
 * was completed in its last seconds. */
const SESSION_TTL_SECONDS = 30 * 60;

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let admin;
  let stripe;
  try {
    admin = supabaseAdmin();
    stripe = stripeClient();
  } catch (err) {
    // A missing env var is a deployment problem, not something the person
    // clicking Subscribe can act on — but it must not look like success.
    console.error("[billing/checkout] configuration", err);
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 500 }
    );
  }

  const { data: existing, error: readError } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("[billing/checkout] read", readError);
    return NextResponse.json(
      { error: "Couldn't read your subscription." },
      { status: 500 }
    );
  }

  // Already paying. Selling them a second subscription would charge them twice
  // for the same thing, and Stripe would happily do it.
  if (blocksNewCheckout(existing)) {
    return NextResponse.json(
      {
        error: "already_subscribed",
        message:
          "You already have an active subscription. Manage it in the billing portal.",
      },
      { status: 409 }
    );
  }

  // Atomic, race-safe, and the only thing that decides founder vs standard.
  const { data: plan, error: claimError } = await admin.rpc("claim_plan", {
    p_user_id: user.id,
  });

  if (claimError || !plan) {
    console.error("[billing/checkout] claim_plan", claimError);
    return NextResponse.json(
      { error: "Couldn't reserve your plan. Try again." },
      { status: 500 }
    );
  }

  const prices = priceIds();
  const price = plan === "founder" ? prices.founder : prices.standard;
  if (!price) {
    console.error(`[billing/checkout] no price id configured for ${plan}`);
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 500 }
    );
  }

  let customerId: string;
  try {
    customerId = await ensureCustomer(stripe, admin, user, existing?.stripe_customer_id ?? null);
  } catch (err) {
    console.error("[billing/checkout] customer", err);
    return NextResponse.json(
      { error: "Couldn't set up your billing account." },
      { status: 500 }
    );
  }

  try {
    const origin = requestOrigin(request);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      // Both derived from this request, so a deploy preview sends its testers
      // back to itself rather than to production.
      success_url: `${origin}/settings/billing?checkout=success`,
      cancel_url: `${origin}/subscribe?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      client_reference_id: user.id,
      // On both the session and the subscription: the session's metadata is
      // what checkout.session.completed carries, the subscription's is what
      // every later customer.subscription.* event carries.
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    });

    if (!session.url) throw new Error("Stripe returned a session with no url");

    return NextResponse.json({ url: session.url, plan });
  } catch (err) {
    console.error("[billing/checkout] session", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Try again." },
      { status: 500 }
    );
  }
}

/**
 * Reuse this user's Stripe customer, or make one.
 *
 * The stored id is reused across subscriptions on purpose — a returning
 * customer keeps their payment methods and their invoice history. If Stripe no
 * longer has it (deleted by hand in the test dashboard, which happens), a fresh
 * one is created rather than failing the checkout.
 */
async function ensureCustomer(
  stripe: ReturnType<typeof stripeClient>,
  admin: ReturnType<typeof supabaseAdmin>,
  user: { id: string; email?: string | null },
  storedCustomerId: string | null
): Promise<string> {
  if (storedCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(storedCustomerId);
      if (!existing.deleted) return existing.id;
    } catch {
      // Falls through to creating a new one.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  });

  // claim_plan has already created the row, so this is always an update.
  const { error } = await admin
    .from("subscriptions")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  // Storing the customer id is what lets the webhook find this user later, so
  // losing it is not survivable: better to fail checkout than to take a payment
  // we cannot attribute.
  if (error) throw error;

  return customer.id;
}
