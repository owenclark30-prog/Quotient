"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type NavItem = { href: string; label: string };
type NavEntry =
  | { kind: "link"; id: string; label: string; href: string }
  | { kind: "menu"; id: string; label: string; items: NavItem[] };

/* An area is either a dropdown of pages or a single link. Adding one — CRM,
 * pipelines, guides — is an entry here and nothing else. */
const NAV: NavEntry[] = [
  {
    kind: "menu",
    id: "proposals",
    label: "Proposals",
    items: [
      { href: "/proposals/new", label: "New proposal" },
      { href: "/proposals", label: "Past proposals" },
    ],
  },
  { kind: "link", id: "rate-card", label: "Rate card", href: "/rate-card" },
];

function isEntryActive(entry: NavEntry, pathname: string) {
  if (entry.kind === "link") return pathname === entry.href;
  // A generated document belongs to the proposals group.
  if (entry.id === "proposals" && pathname === "/proposal") return true;
  return entry.items.some((item) => pathname === item.href);
}

export function AppNav() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  // One id at a time, so opening a menu closes whichever was open.
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => setOpenMenu(null), [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMenu]);

  // Signed out (or on /login) there's nothing to navigate to.
  if (loading || !session) return null;

  const toggle = (id: string) =>
    setOpenMenu((current) => (current === id ? null : id));

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <Link href="/" className="app-nav-brand">
          Quotient
        </Link>

        <nav className="app-nav-links">
          {NAV.map((entry) => {
            const active = isEntryActive(entry, pathname);

            if (entry.kind === "link") {
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className={`app-nav-link${active ? " active" : ""}`}
                >
                  {entry.label}
                </Link>
              );
            }

            return (
              <div key={entry.id} className="app-nav-menu-wrap">
                <button
                  type="button"
                  className={`app-nav-link app-nav-link-button${
                    active ? " active" : ""
                  }`}
                  aria-expanded={openMenu === entry.id}
                  onClick={() => toggle(entry.id)}
                >
                  {entry.label}
                  <span aria-hidden="true" className="app-nav-caret">
                    ▾
                  </span>
                </button>

                {openMenu === entry.id && (
                  <div className="app-nav-menu app-nav-menu-left">
                    {entry.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-menu-item${
                          pathname === item.href ? " current" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="app-nav-account">
          <button
            type="button"
            className="app-nav-account-button"
            aria-expanded={openMenu === "account"}
            onClick={() => toggle("account")}
          >
            Account
            <span aria-hidden="true" className="app-nav-caret">
              ▾
            </span>
          </button>

          {openMenu === "account" && (
            <div className="app-nav-menu">
              <Link
                href="/settings"
                className={`app-nav-menu-item${
                  pathname === "/settings" ? " current" : ""
                }`}
              >
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
          )}
        </div>
      </div>

      {openMenu && (
        <div className="app-nav-backdrop" onClick={() => setOpenMenu(null)} />
      )}
    </header>
  );
}
