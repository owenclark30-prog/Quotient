"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  getFounderSlots,
  startCheckout,
  type FounderSlots,
} from "@/lib/data/billing";
import {
  FOUNDER_SLOT_LIMIT,
  PLAN_PRICE_LABEL,
  isFounderTierOpen,
} from "@/lib/billing";
import { errorMessage } from "@/lib/errors";
import { RequireAuth } from "../components/RequireAuth";
import { useSubscription } from "../components/SubscriptionProvider";

export default function SubscribePage() {
  return (
    // Without this the page would redirect to itself forever: it is where
    // people without a subscription are sent.
    <RequireAuth allowWithoutSubscription>
      <Suspense
        fallback={
          <main>
            <p className="subtitle">Loading…</p>
          </main>
        }
      >
        <Subscribe />
      </Suspense>
    </RequireAuth>
  );
}

function Subscribe() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("checkout") === "cancelled";
  const { access, subscription } = useSubscription();

  const [slots, setSlots] = useState<FounderSlots | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFounderSlots()
      .then(setSlots)
      .catch(() => setSlotsError(true));
  }, []);

  async function handleSubscribe() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const { url } = await startCheckout();
      window.location.href = url;
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      setError(
        code === "already_subscribed"
          ? "You already have an active subscription. Open the billing page to manage it."
          : errorMessage(err, "Couldn't start checkout. Try again.")
      );
      setStarting(false);
    }
  }

  const founderOpen = slots ? isFounderTierOpen(slots.used, slots.limit) : false;
  const plan = founderOpen ? "founder" : "standard";

  // Someone whose payment failed lands here once the grace period runs out.
  const lapsed = subscription && !access.allowed && subscription.status;

  return (
    <main>
      <h1>Subscribe</h1>
      <p className="subtitle">
        {lapsed
          ? "Your subscription isn't active. Start it again below."
          : "Quotient is a subscription. Pick up where you left off."}
      </p>

      {cancelled && (
        <div className="warning-banner">
          Checkout cancelled — nothing was charged.
        </div>
      )}

      {error && <div className="empty-state error-state">{error}</div>}

      <section>
        <div className="plan-card">
          <div className="plan-card-head">
            <h2 className="plan-name">
              {founderOpen ? "Founder" : "Standard"}
            </h2>
            <span className="plan-price">{PLAN_PRICE_LABEL[plan]}</span>
          </div>

          {slots && founderOpen && (
            <p className="plan-slots">
              <strong>
                {slots.remaining} of {slots.limit} founder{" "}
                {slots.remaining === 1 ? "spot" : "spots"} left
              </strong>{" "}
              — locked at {PLAN_PRICE_LABEL.founder} for as long as your
              subscription stays active.
            </p>
          )}

          {slots && !founderOpen && (
            <p className="plan-slots">
              All {slots.limit} founder spots have gone. Standard pricing is{" "}
              {PLAN_PRICE_LABEL.standard}.
            </p>
          )}

          {!slots && !slotsError && (
            <p className="field-hint">Checking founder spots…</p>
          )}

          {slotsError && (
            <p className="field-hint">
              Couldn&rsquo;t check the founder spots. Your price is worked out
              again when you reach checkout, so this doesn&rsquo;t affect what
              you pay.
            </p>
          )}

          <ul className="plan-features">
            <li>Pricing, proposals and onboarding</li>
            <li>Your rate card, tiers and services</li>
            <li>Everything added while you&rsquo;re subscribed</li>
          </ul>

          <button
            type="button"
            className="button-primary plan-cta"
            onClick={handleSubscribe}
            disabled={starting}
          >
            {starting ? "Opening checkout…" : "Subscribe"}
          </button>

          <p className="field-hint">
            Card details are handled by Stripe. Cancel any time from your
            billing page.
          </p>
        </div>
      </section>

      <p className="field-hint">
        The founder price is limited to the first {FOUNDER_SLOT_LIMIT} members
        and is held while your subscription stays active. Your spot is reserved
        while you complete checkout.
      </p>
    </main>
  );
}
