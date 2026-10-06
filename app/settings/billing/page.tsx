"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { openBillingPortal } from "@/lib/data/billing";
import { FOUNDER_SLOT_LIMIT, PLAN_LABEL, PLAN_PRICE_LABEL } from "@/lib/billing";
import { billingDisplay, checkoutReflected } from "@/lib/billing-display";
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

const CHECKOUT_POLL_MS = 2000;
const MAX_CHECKOUT_POLLS = 8;

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
  const [polls, setPolls] = useState(0);

  // The webhook and the browser race after checkout: Stripe redirects back the
  // moment payment succeeds, which can be before the event lands. Re-read every
  // couple of seconds until the subscription shows, then stop. Bounded, so a
  // webhook that never arrives doesn't poll forever.
  const awaitingWebhook = justCheckedOut && !checkoutReflected(subscription);
  const stillPolling = awaitingWebhook && polls < MAX_CHECKOUT_POLLS;

  useEffect(() => {
    if (loading || !stillPolling) return;
    const timer = setTimeout(() => {
      setPolls((n) => n + 1);
      refresh();
    }, CHECKOUT_POLL_MS);
    return () => clearTimeout(timer);
  }, [loading, stillPolling, polls, refresh]);

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
  const hasBillingAccount = Boolean(subscription?.stripe_customer_id);
  // Which rows and notes to show. Display only — access is decided by
  // accessState(), which this does not touch.
  const display = billingDisplay(subscription);
  const renewalDate = display.renewal ? formatDate(display.renewal.date) : null;

  return (
    <main>
      <h1>
        Billing
        {/* Beside the title rather than next to the plan name, where it would
            just repeat the word "Founder" back at itself. */}
        {plan === "founder" && <span className="founder-badge">Founder</span>}
      </h1>
      <p className="subtitle">Your plan, and what happens next</p>

      {/* Gone the moment the subscription row shows up, rather than sitting on
          top of a page that already shows it. */}
      {awaitingWebhook && (
        <div className="form-notice checkout-notice">
          {stillPolling
            ? "Payment received. Your subscription may take a few seconds to show here."
            : "Payment received, but Stripe hasn't confirmed it to us yet. Refresh this page in a minute."}
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

          {plan && display.showPrice && (
            <div className="pricing-row">
              <span className="pricing-label">Price</span>
              <span className="pricing-value">{PLAN_PRICE_LABEL[plan]}</span>
            </div>
          )}

          {display.renewal && renewalDate && (
            <div className="pricing-row">
              <span className="pricing-label">{display.renewal.label}</span>
              <span className="pricing-value">{renewalDate}</span>
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

        {display.compedNote === "comped_only" && (
          <p className="field-hint comped-note">
            Your access is complimentary. There&rsquo;s nothing to pay and no
            card on file.
          </p>
        )}

        {display.compedNote === "comped_and_live" && (
          <p className="field-hint comped-note">
            Your access is complimentary, and you also have a live Stripe
            subscription that is being billed. You keep access either way — cancel
            the subscription in the billing portal if you don&rsquo;t need it.
          </p>
        )}

        {display.showCancellingBanner && (
          <div className="warning-banner cancelling-banner">
            {comped ? (
              // Their access doesn't end with the subscription, so don't say it
              // does.
              <>
                Your subscription is set to cancel on{" "}
                {renewalDate ?? "the end of the current period"}. Your
                complimentary access isn&rsquo;t affected.
              </>
            ) : (
              <>
                Your subscription is set to cancel. You keep access until{" "}
                {renewalDate ?? "the end of the current period"}. Reopen the
                portal to undo it.
              </>
            )}
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
