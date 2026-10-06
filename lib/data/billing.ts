import { supabase } from "@/lib/supabase/client";
import type { Subscription } from "@/lib/supabase/types";

/**
 * The browser's half of billing.
 *
 * Reads go straight to the subscriptions table, where RLS confines the user to
 * their own row. Writes don't exist here at all: there is no grant for them.
 * Anything that changes money goes through a server route, which is the only
 * place the service role and the Stripe key live.
 */

/** Null when this user has never been near checkout. */
export async function getMySubscription(): Promise<Subscription | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** The access token, for the routes that verify it server-side. */
async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not signed in");
  return { authorization: `Bearer ${session.access_token}` };
}

type ApiError = { error?: string; message?: string; portalUrl?: string };

/** What a failed billing call carries beyond its message. */
export type BillingError = Error & {
  /** e.g. "already_subscribed" — so the caller can tell "you already pay for
   * this" from a genuine failure. */
  code?: string;
  /** Where to send someone who was refused a second subscription. */
  portalUrl?: string;
};

async function post(path: string): Promise<{ url: string }> {
  const response = await fetch(path, {
    method: "POST",
    headers: await authHeader(),
  });

  const body = (await response.json().catch(() => ({}))) as ApiError & {
    url?: string;
  };

  if (!response.ok) {
    const error: BillingError = new Error(
      body.message ?? body.error ?? "Something went wrong."
    );
    error.code = body.error;
    error.portalUrl = body.portalUrl;
    throw error;
  }

  if (!body.url) throw new Error("No redirect URL came back.");
  return { url: body.url };
}

/** Returns the Stripe Checkout URL to send the browser to. */
export async function startCheckout() {
  return post("/api/billing/checkout");
}

/** Returns the Stripe Customer Portal URL. */
export async function openBillingPortal() {
  return post("/api/billing/portal");
}

export type FounderSlots = {
  used: number;
  limit: number;
  remaining: number;
};

export async function getFounderSlots(): Promise<FounderSlots> {
  const response = await fetch("/api/billing/founder-slots", {
    headers: await authHeader(),
  });

  if (!response.ok) throw new Error("Couldn't check the founder spots.");
  return (await response.json()) as FounderSlots;
}
