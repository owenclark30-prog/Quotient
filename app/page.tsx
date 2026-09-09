"use client";

import Link from "next/link";
import { RequireAuth } from "./components/RequireAuth";

/** The app's home. Every entry point lives here, so a new feature is a new
 * entry in this list and nothing else — the grid reflows on its own. */
const DESTINATIONS = [
  {
    href: "/proposals/new",
    title: "New proposal",
    description: "Price a client against one of your tiers and generate a proposal.",
  },
  {
    href: "/proposals",
    title: "Past proposals",
    description: "Everything you've saved, at the numbers it was sent at.",
  },
  {
    href: "/rate-card",
    title: "Rate card",
    description: "Your services, the tiers they group into, and what each one costs.",
  },
];

export default function HomePage() {
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}

function Home() {
  return (
    <main>
      <h1>Quotient</h1>
      <p className="subtitle">Price your offer and send a proposal for it.</p>

      <div className="home-grid">
        {DESTINATIONS.map((destination) => (
          <Link
            key={destination.href}
            href={destination.href}
            className="home-card"
          >
            <span className="home-card-title">{destination.title}</span>
            <span className="home-card-description">
              {destination.description}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
