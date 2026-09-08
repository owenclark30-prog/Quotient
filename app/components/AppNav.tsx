"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const NAV_LINKS = [
  { href: "/", label: "Proposals", match: ["/", "/proposal"] },
  { href: "/proposals", label: "Past proposals", match: ["/proposals"] },
  { href: "/rate-card", label: "Rate card", match: ["/rate-card"] },
];

export function AppNav() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the account menu on navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  // Signed out (or on /login) there's nothing to navigate to.
  if (loading || !session) return null;

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <Link href="/" className="app-nav-brand">
          Quotient
        </Link>

        <nav className="app-nav-links">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/" || pathname === "/proposal"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`app-nav-link${active ? " active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-nav-account">
          <button
            type="button"
            className="app-nav-account-button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Account
            <span aria-hidden="true" className="app-nav-caret">
              ▾
            </span>
          </button>

          {menuOpen && (
            <>
              <div
                className="app-nav-backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <div className="app-nav-menu">
                <Link href="/settings" className="app-nav-menu-item">
                  Agency settings
                </Link>
                <button
                  type="button"
                  className="app-nav-menu-item"
                  onClick={() => supabase.auth.signOut()}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
