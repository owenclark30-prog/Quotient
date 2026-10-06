"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getMySubscription } from "@/lib/data/billing";
import { accessState, type AccessState } from "@/lib/billing";
import type { Subscription } from "@/lib/supabase/types";
import { useAuth } from "./AuthProvider";

type SubscriptionState = {
  subscription: Subscription | null;
  access: AccessState;
  loading: boolean;
  /** The read failed. Distinct from "no subscription": one is a fact about the
   * user, the other is a fact about the network. */
  error: string | null;
  refresh: () => void;
};

/** Loading starts as true so nothing renders a decision before the answer is
 * in. The paywall checks `loading` before it redirects anyone. */
const NO_ACCESS: AccessState = {
  allowed: false,
  reason: "no_subscription",
  graceEndsAt: null,
};

const SubscriptionContext = createContext<SubscriptionState>({
  subscription: null,
  access: NO_ACCESS,
  loading: true,
  error: null,
  refresh: () => {},
});

/**
 * Loads the signed-in user's subscription once and shares it.
 *
 * In the provider rather than in each page because the paywall, the nav badge
 * and the billing page all need the same answer, and three independent fetches
 * of the same row would be three chances to disagree.
 */
export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /** Whose row is currently loaded. A refresh for the same user re-reads in the
   * background; only a first load (or a different user) shows as loading, so a
   * page polling for a webhook doesn't blank itself on every re-read. */
  const loadedFor = useRef<string | null>(null);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      loadedFor.current = null;
      setSubscription(null);
      setError(null);
      setLoading(false);
      return;
    }

    const userId = session.user.id;
    let cancelled = false;
    if (loadedFor.current !== userId) setLoading(true);

    getMySubscription()
      .then((row) => {
        if (cancelled) return;
        setSubscription(row);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A first load that fails gets no subscription: a read error is not a
        // subscription, and failing open here would make the paywall advisory.
        // A background re-read that fails keeps the row already showing —
        // dropping a paying customer to "None" over a blip helps nobody.
        if (loadedFor.current !== userId) setSubscription(null);
        setError(
          err instanceof Error ? err.message : "Couldn't check your subscription."
        );
      })
      .finally(() => {
        if (cancelled) return;
        loadedFor.current = userId;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, authLoading, reloadToken]);

  const value = useMemo<SubscriptionState>(
    () => ({
      subscription,
      access: subscription ? accessState(subscription) : NO_ACCESS,
      loading: authLoading || loading,
      error,
      refresh,
    }),
    [subscription, authLoading, loading, error, refresh]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
