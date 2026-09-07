"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/** Gates a page behind a session, redirecting to /login when there isn't one.
 * RLS is the real boundary; this just keeps signed-out users off the UI. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <main>
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
