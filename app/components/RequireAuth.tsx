"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useSubscription } from "./SubscriptionProvider";

/**
 * Gates a page behind a session and a subscription.
 *
 * Signed out goes to /login; signed in without access goes to /subscribe. RLS
 * and the server routes are the real boundaries — this just keeps people off
 * pages that would be no use to them.
 *
 * `allowWithoutSubscription` is for the two pages someone without access still
 * has to reach: /subscribe itself, and the billing page where they fix a failed
 * payment. Gating those would be a redirect loop or a locked door with the key
 * behind it.
 */
export function RequireAuth({
  children,
  allowWithoutSubscription = false,
}: {
  children: React.ReactNode;
  allowWithoutSubscription?: boolean;
}) {
  const { session, loading } = useAuth();
  const { access, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();

  const waiting = loading || (!allowWithoutSubscription && subscriptionLoading);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (allowWithoutSubscription || subscriptionLoading) return;
    if (!access.allowed) router.replace("/subscribe");
  }, [
    loading,
    session,
    access.allowed,
    subscriptionLoading,
    allowWithoutSubscription,
    router,
  ]);

  if (waiting || !session) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (!allowWithoutSubscription && !access.allowed) {
    return (
      <main>
        <p className="subtitle">Taking you to your subscription…</p>
      </main>
    );
  }

  return <>{children}</>;
}
