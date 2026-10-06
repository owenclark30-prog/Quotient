import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Stripe-hosted portal: change card, see invoices, cancel. Everything that
 * would otherwise be a page of our own to build and keep correct. */
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
    console.error("[billing/portal] configuration", err);
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 500 }
    );
  }

  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[billing/portal] read", error);
    return NextResponse.json(
      { error: "Couldn't read your subscription." },
      { status: 500 }
    );
  }

  // No customer means they have never been through checkout. There is nothing
  // for the portal to show, and Stripe would reject the call anyway.
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_billing_account", message: "You don't have a billing account yet." },
      { status: 404 }
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${requestOrigin(request)}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] session", err);
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Try again." },
      { status: 500 }
    );
  }
}
