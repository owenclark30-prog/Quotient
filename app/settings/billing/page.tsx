"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { openBillingPortal } from "@/lib/data/billing";
import { FOUNDER_SLOT_LIMIT, PLAN_LABEL, PLAN_PRICE_LABEL } from "@/lib/billing";
import { errorMessage } from "@/lib/errors";
import { RequireAuth } from "../../components/RequireAuth";
import { useSubscription } from "../../components/SubscriptionProvider";

export default function BillingPage() {
  return (
    // Reachable without access on purpose: this is where someone whose payment
    // failed comes to fix it.
    <RequireAuth allowWithoutSubscription>
      <Suspense
        fallback={
          <main>
            <p className="subtitle">Loading…</p>
          </main>
        }
      >
        <Billing />
      </Suspense>
    </RequireAuth>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Stripe's status, in words an agency owner can act on. */
function statusLabel(status: string | null, comped: boolean) {
  if (comped) return "Complimentary";
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Payment failed";
    case "canceled":
      return "Cancelled";
    case "unpaid":
      return "Unpaid";
    case "incomplete":
      return "Awaiting payment";
    case "incomplete_expired":
      return "Payment never completed";
    case "paused":
      return "Paused";
    case null:
      return "None";
    default:
      // A status this build predates. Show it rather than inventing a label.
      return status;
  }
}

function Billing() {
  const searchParams = useSearchParams();
  const justCheckedOut = searchParams.get("checkout") === "success";
  const { subscription, access, loading, error, refresh } = useSubscription();

  const [opening, setOpening] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // The webhook and the browser race after checkout: Stripe redirects back the
  // moment payment succeeds, which can be before the event lands. One delayed
  // re-read turns "None" into the real subscription without a manual reload.
  useEffect(() => {
    if (!justCheckedOut) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [justCheckedOut, refresh]);

  async function handlePortal() {
    if (opening) return;
    setOpening(true);
    setPortalError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setPortalError(
        errorMessage(err, "Couldn't open the billing portal. Try again.")
      );
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  const comped = Boolean(subscription?.comped);
  const plan = subscription?.plan ?? null;
  const renewal = formatDate(subscription?.current_period_end ?? null);
  const cancelling = Boolean(subscription?.cancel_at_period_end);
  const hasBillingAccount = Boolean(subscription?.stripe_customer_id);

  return (
    <main>
      <h1>
        Billing
        {/* Beside the title rather than next to the plan name, where it would
            just repeat the word "Founder" back at itself. */}
        {plan === "founder" && <span className="founder-badge">Founder</span>}
      </h1>
      <p className="subtitle">Your plan, and what happens next</p>

      {justCheckedOut && (
        <div className="form-notice">
          Payment received. Your subscription may take a few seconds to show
          here.
        </div>
      )}

      {error && (
        <div className="warning-banner">
          {error} — the figures below may be out of date.
        </div>
      )}

      {portalError && <div className="empty-state error-state">{portalError}</div>}

      <section>
        <label>Current plan</label>
        <div className="pricing-box">
          <div className="pricing-row">
            <span className="pricing-label">Plan</span>
            <span className="pricing-value">
              {plan ? PLAN_LABEL[plan] : "None"}
            </span>
          </div>

          <div className="pricing-row">
            <span className="pricing-label">Status</span>
            <span className="pricing-value">
              {statusLabel(subscription?.status ?? null, comped)}
            </span>
          </div>

          {plan && !comped && (
            <div className="pricing-row">
              <span className="pricing-label">Price</span>
              <span className="pricing-value">{PLAN_PRICE_LABEL[plan]}</span>
            </div>
          )}

          {renewal && (
            <div className="pricing-row">
              <span className="pricing-label">
                {cancelling ? "Access ends" : "Next renewal"}
              </span>
              <span className="pricing-value">{renewal}</span>
            </div>
          )}
        </div>

        {plan === "founder" && !comped && (
          <p className="field-hint">
            You&rsquo;re one of the first {FOUNDER_SLOT_LIMIT} members. This
            price is held for as
            long as your subscription stays active — if it lapses, the spot goes
            back into the pool.
          </p>
        )}

        {comped && (
          <p className="field-hint">
            Your access is complimentary. There&rsquo;s nothing to pay and no
            card on file.
          </p>
        )}

        {cancelling && (
          <div className="warning-banner">
            Your subscription is set to cancel. You keep access until{" "}
            {renewal ?? "the end of the current period"}. Reopen the portal to
            undo it.
          </div>
        )}

        {access.reason === "grace" && (
          <div className="warning-banner">
            Your last payment failed. You still have access
            {access.graceEndsAt
              ? ` until ${formatDate(access.graceEndsAt.toISOString())}`
              : " for a few more days"}{" "}
            — update your card in the portal to keep it.
          </div>
        )}

        {access.reason === "grace_expired" && (
          <div className="warning-banner">
            Your payment failed and the grace period has run out. Update your
            card in the portal to get back in.
          </div>
        )}
      </section>

      <section>
        {hasBillingAccount ? (
          <>
            <button
              type="button"
              className="button-primary"
              onClick={handlePortal}
              disabled={opening}
            >
              {opening ? "Opening…" : "Manage billing"}
            </button>
            <p className="field-hint">
              Change your card, see invoices, or cancel — all handled by Stripe.
            </p>
          </>
        ) : (
          <>
            <Link href="/subscribe" className="button-primary">
              Subscribe
            </Link>
            <p className="field-hint">
              {comped
                ? "You don't need a subscription — your access is complimentary."
                : "You don't have a subscription yet."}
            </p>
          </>
        )}
      </section>

      <p className="field-hint">
        <Link href="/settings" className="text-link">
          &larr; Agency settings
        </Link>
      </p>
    </main>
  );
}
