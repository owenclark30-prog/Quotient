"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

/* Everything the app does today sits under one menu. A second top-level menu
 * goes in NAV_MENUS beside this one, and the bar needs no other change. */
const NAV_MENUS = [
  {
    id: "proposals",
    label: "Proposals",
    items: [
      { href: "/proposals/new", label: "New proposal" },
      { href: "/proposals", label: "Past proposals" },
      { href: "/rate-card", label: "Rate card" },
    ],
  },
];

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
          {NAV_MENUS.map((menu) => {
            // /proposal (a generated document) belongs to this group too.
            const active =
              menu.items.some((item) => pathname === item.href) ||
              (menu.id === "proposals" && pathname === "/proposal");

            return (
              <div key={menu.id} className="app-nav-menu-wrap">
                <button
                  type="button"
                  className={`app-nav-link app-nav-link-button${
                    active ? " active" : ""
                  }`}
                  aria-expanded={openMenu === menu.id}
                  onClick={() => toggle(menu.id)}
                >
                  {menu.label}
                  <span aria-hidden="true" className="app-nav-caret">
                    ▾
                  </span>
                </button>

                {openMenu === menu.id && (
                  <div className="app-nav-menu app-nav-menu-left">
                    {menu.items.map((item) => (
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
