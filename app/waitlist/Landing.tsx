"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFounderSlots, type FounderSlots } from "@/lib/data/billing";
import { joinWaitlist } from "@/lib/data/waitlist";
import { errorMessage } from "@/lib/errors";
import { SIGNUP_PATH, type LandingMode } from "@/lib/landing";
import styles from "./landing.module.css";

/** Public. Deliberately not wrapped in RequireAuth: this is the one page anyone
 * can reach. In waitlist mode it reads nothing; live, it reads only the public
 * founder-spot count. */
export function Landing({
  mode,
  fontClassName,
}: {
  mode: LandingMode;
  fontClassName: string;
}) {
  return (
    <div className={`${styles.landing} ${fontClassName}`} id="top">
      <Nav mode={mode} />

      <main className={styles.main}>
        <Hero mode={mode} />
        <HowItWorks />
        <Pricing mode={mode} />
        {mode === "waitlist" && <Waitlist />}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.wordmark}>Quotient.</span>
          <span>Pricing, proposals and onboarding for automation agencies.</span>
          <ul className={styles.footerLinks}>
            {LEGAL_LINKS.map((link) =>
              link.href ? (
                <li key={link.label}>
                  <Link href={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                </li>
              ) : (
                <li key={link.label} className={styles.footerPlaceholder}>
                  {link.label}
                </li>
              )
            )}
          </ul>
        </div>
      </footer>
    </div>
  );
}

/* Placeholders until the pages exist: shown as plain text rather than links to
   a 404. Set an href and the entry becomes a real link. In waitlist mode the
   gate redirects every path but this page, so a legal page needs a gate
   exemption before it can be linked from here. */
const LEGAL_LINKS: { label: string; href: string | null }[] = [
  { label: "Privacy", href: null },
  { label: "Terms", href: null },
];

// ------------------------------------------------------------------- CTAs

const WAITLIST_ANCHOR = "waitlist";
const WAITLIST_EMAIL = "waitlist-email";

/**
 * Every "Claim a founder spot" on the page. Waitlist: a link down to the form,
 * which then takes focus so the next keystroke is the email. Live: create an
 * account, then /subscribe. Always a real link, so it works without JavaScript
 * and opens in a new tab like one.
 */
function ClaimLink({
  mode,
  className,
}: {
  mode: LandingMode;
  className: string;
}) {
  if (mode === "live") {
    return (
      <Link href={SIGNUP_PATH} className={className}>
        Claim a founder spot
      </Link>
    );
  }

  return (
    <a
      href={`#${WAITLIST_ANCHOR}`}
      className={className}
      onClick={() => {
        // The browser does the scrolling; focus follows without a second jump.
        requestAnimationFrame(() =>
          document
            .getElementById(WAITLIST_EMAIL)
            ?.focus({ preventScroll: true })
        );
      }}
    >
      Claim a founder spot
    </a>
  );
}

// -------------------------------------------------------------------- nav

function Nav({ mode }: { mode: LandingMode }) {
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <a href="#top" className={styles.wordmark}>
          Quotient.
        </a>

        <nav aria-label="Main" className={styles.navLinks}>
          <a href="#how" className={`${styles.navLink} ${styles.navSection}`}>
            How it works
          </a>
          <a
            href="#pricing"
            className={`${styles.navLink} ${styles.navSection}`}
          >
            Pricing
          </a>
          {/* Waitlist mode seals /login behind the gate, so a sign-in link
              would only reload this page. */}
          {mode === "live" && (
            <Link href="/login" className={styles.navLink}>
              Sign in
            </Link>
          )}
          <ClaimLink
            mode={mode}
            className={`${styles.button} ${styles.buttonPrimary} ${styles.navCta}`}
          />
        </nav>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------- hero

function Hero({ mode }: { mode: LandingMode }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Streak />

      <div className={styles.heroText}>
        <p className={styles.pill}>For AI and automation agencies</p>

        <h1 id="hero-title" className={styles.heroTitle}>
          Price every client from their own numbers.
        </h1>

        <p className={styles.heroSub}>
          Enter what the automation recovers for the client. Quotient prices
          it, checks it against your delivery costs so you never quote below
          margin, and builds the proposal and onboarding docs.
        </p>

        <div className={styles.heroActions}>
          <ClaimLink
            mode={mode}
            className={`${styles.button} ${styles.buttonPrimary}`}
          />
          <a href="#how" className={`${styles.button} ${styles.buttonGhost}`}>
            See how it works
          </a>
        </div>

        <p className={styles.heroNote}>
          £29/mo for the first 25 agencies, locked while you stay subscribed.
        </p>
      </div>

      <HeroVisual />
    </section>
  );
}

/* The example the cards show. The band positions are computed from the
   figures, so the floor and target markers can't drift from their labels. */
const EXAMPLE = { low: 254, high: 634, floor: 280, target: 380 };

function bandPosition(value: number) {
  const { low, high } = EXAMPLE;
  return `${(((value - low) / (high - low)) * 100).toFixed(1)}%`;
}

const PROPOSAL_LINES = [
  "Enquiry capture and instant response",
  "Lead qualification",
  "Online booking and reminders",
  "Review requests",
];

const RATE_CARD = [
  { tier: "Tier 1", name: "Missed Enquiry Recovery" },
  { tier: "Tier 2", name: "Full Front-Desk System" },
  { tier: "Tier 3", name: "Complete Patient Comms" },
];

/**
 * Three overlapping cards: the pricing step, the proposal it produces and the
 * rate card behind both. An illustration, so assistive tech gets one sentence
 * rather than every figure on three cards.
 */
function HeroVisual() {
  return (
    <div
      className={styles.visual}
      role="img"
      aria-label="Example: a client's automation creates £3,624 a month in value. Quotient suggests £380 a month plus £760 setup, above the £280 cost floor, and builds the proposal from the agency's rate card."
    >
      <div className={`${styles.card} ${styles.proposalCard}`}>
        <p className={styles.proposalLabel}>Proposal</p>
        <p className={styles.proposalClient}>Demonstration Client</p>
        <p className={styles.proposalTier}>Full Front-Desk System</p>
        <ul className={styles.proposalLines}>
          {PROPOSAL_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <dl className={styles.proposalTotal}>
          <div>
            <dt>Monthly</dt>
            <dd className={styles.mono}>£380</dd>
          </div>
          <div>
            <dt>Setup</dt>
            <dd className={styles.mono}>£760</dd>
          </div>
        </dl>
      </div>

      <div className={`${styles.card} ${styles.priceCard}`}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Price this client</span>
          <span className={styles.chip}>Example</span>
        </div>

        <dl className={styles.figures}>
          <div>
            <dt>Value created</dt>
            <dd className={styles.mono}>£3,624/mo</dd>
          </div>
          <div>
            <dt>Held to 70%</dt>
            <dd className={styles.mono}>£2,537/mo</dd>
          </div>
        </dl>

        <div className={styles.band}>
          <div className={styles.bandAbove}>
            <span
              className={styles.floorLabel}
              style={{ left: bandPosition(EXAMPLE.floor) }}
            >
              Floor <span className={styles.mono}>£280</span>
            </span>
          </div>
          <div className={styles.bandTrack}>
            <span
              className={styles.floorMark}
              style={{ left: bandPosition(EXAMPLE.floor) }}
            />
            <span
              className={styles.targetMark}
              style={{ left: bandPosition(EXAMPLE.target) }}
            />
          </div>
          <div className={styles.bandEnds}>
            <span>
              <span className={styles.mono}>£254</span> low
            </span>
            <span>
              <span className={styles.mono}>£634</span> high
            </span>
          </div>
        </div>

        <div className={styles.suggested}>
          <span>Suggested</span>
          <span className={styles.suggestedPrice}>
            <span className={`${styles.mono} ${styles.suggestedValue}`}>
              £380/mo
            </span>{" "}
            <span className={styles.suggestedSetup}>
              + <span className={styles.mono}>£760</span> setup
            </span>
          </span>
        </div>
      </div>

      <div className={`${styles.card} ${styles.rateCard}`}>
        <p className={styles.cardTitle}>Rate card</p>
        <ul className={styles.rateList}>
          {RATE_CARD.map((row) => (
            <li key={row.tier}>
              <span className={styles.rateTier}>{row.tier}</span>
              <span>{row.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* The streak's one curve, in a viewBox the hero is stretched to. Both ends lie
   outside the box, so the SVG's own edge cuts the line exactly at the screen
   edges: it enters bottom left and leaves top right with no gap at either end.
   The low first control point keeps it under the hero text on the left. */
const STREAK_PATH = "M -80 714 C 720 712 980 430 1520 -10";

/**
 * Decorative: a royal-blue streak across the whole hero, behind the cards. A
 * 2.5px line over a blurred wider copy at 55%, and one spark that runs the
 * length of it every seven seconds.
 *
 * The viewBox is stretched to the hero (preserveAspectRatio="none"), so
 * the line and the spark use non-scaling strokes to keep their width.
 *
 * The spark is two dashes on the same path, a blue tail with a white head,
 * over a wide faint copy for the glow, so no filter repaints every frame.
 * With reduced motion it isn't drawn at all; the line stays as it is.
 */
function Streak() {
  return (
    <svg
      className={styles.streak}
      viewBox="0 0 1440 720"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          id="streak-blur"
          x="-10%"
          y="-30%"
          width="120%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <path
        d={STREAK_PATH}
        fill="none"
        stroke="#2F6BFF"
        strokeWidth="14"
        opacity="0.55"
        filter="url(#streak-blur)"
      />
      <path
        d={STREAK_PATH}
        fill="none"
        stroke="#2F6BFF"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />

      <g className={styles.spark}>
        <path
          className={styles.sparkGlow}
          d={STREAK_PATH}
          pathLength={1000}
          fill="none"
          stroke="#8FB0FF"
          strokeWidth="10"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={styles.sparkTail}
          d={STREAK_PATH}
          pathLength={1000}
          fill="none"
          stroke="#6F9BFF"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={styles.sparkHead}
          d={STREAK_PATH}
          pathLength={1000}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

// ----------------------------------------------------------- how it works

const STEPS = [
  {
    title: "Set your rate card once",
    body: "Your tiers, delivery costs and target margin.",
  },
  {
    title: "Price a client when it matters",
    body: "Enter missed enquiries, no-shows, dormant leads and hours saved, and get a low, target and high price checked against your cost floor. Or just use a preset tier.",
  },
  {
    title: "Send the proposal and onboarding docs",
    body: "Generated from the same numbers.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className={styles.section} aria-labelledby="how-title">
      <h2 id="how-title" className={styles.sectionTitle}>
        How it works
      </h2>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={`${styles.mono} ${styles.stepNumber}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- pricing

function Pricing({ mode }: { mode: LandingMode }) {
  return (
    <section
      id="pricing"
      className={styles.section}
      aria-labelledby="pricing-title"
    >
      <h2 id="pricing-title" className={styles.sectionTitle}>
        Pricing
      </h2>

      <div className={styles.plans}>
        <div className={`${styles.plan} ${styles.planFounder}`}>
          <h3 className={styles.planName}>Founder</h3>
          <p className={styles.planPrice}>
            <span className={styles.mono}>£29</span>/mo
          </p>
          <ul className={styles.planList}>
            <li>For the first 25 agencies</li>
            <li>Locked while you stay subscribed</li>
          </ul>
          {/* Waitlist mode doesn't ask: the gate redirects the route, and
              nobody can claim a spot until the app opens anyway. */}
          {mode === "live" && <SpotsLeft />}
          <ClaimLink
            mode={mode}
            className={`${styles.button} ${styles.buttonPrimary} ${styles.planCta}`}
          />
        </div>

        <div className={styles.plan}>
          <h3 className={styles.planName}>Standard</h3>
          <p className={styles.planPrice}>
            <span className={styles.mono}>£39</span>/mo
          </p>
          <ul className={styles.planList}>
            <li>For every agency after the first 25</li>
            <li>Pricing, proposals and onboarding docs</li>
          </ul>
        </div>
      </div>

      <p className={styles.plansNote}>Cancel anytime from your billing page.</p>
    </section>
  );
}

/** The live count. Says nothing until it has a number: a failed or slow fetch
 * leaves the card as it would read with no counter at all. */
function SpotsLeft() {
  const [slots, setSlots] = useState<FounderSlots | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFounderSlots()
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .catch(() => {
        // Optional extra; the card stands without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className={styles.spots} aria-live="polite">
      {slots &&
        (slots.remaining > 0 ? (
          <>
            <span className={styles.mono}>{slots.remaining}</span> of{" "}
            <span className={styles.mono}>{slots.limit}</span> spots left
          </>
        ) : (
          <>All founder spots are taken. New agencies join on Standard.</>
        ))}
    </p>
  );
}

// --------------------------------------------------------------- waitlist

function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await joinWaitlist(email, name);
      setJoined(true);
    } catch (err) {
      setError(
        errorMessage(err, "Couldn't add you to the list. Try again in a moment.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id={WAITLIST_ANCHOR}
      className={styles.section}
      aria-labelledby="waitlist-title"
    >
      <div className={styles.waitlistCard}>
        <h2 id="waitlist-title" className={styles.sectionTitle}>
          Join the waitlist
        </h2>
        <p className={styles.waitlistCopy}>
          Founder pricing opens to the first 25 agencies at £29/mo, locked
          while you stay subscribed. Leave your email and we&rsquo;ll tell you
          when it opens.
        </p>

        {joined ? (
          <p className={styles.status} role="status">
            You&rsquo;re on the list. We&rsquo;ll email you when it opens.
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label htmlFor="waitlist-name" className={styles.srOnly}>
              Your name (optional)
            </label>
            <input
              id="waitlist-name"
              className={styles.field}
              type="text"
              autoComplete="name"
              placeholder="Your name (optional)"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor={WAITLIST_EMAIL} className={styles.srOnly}>
              Email address
            </label>
            <input
              id={WAITLIST_EMAIL}
              className={styles.field}
              type="email"
              required
              autoComplete="email"
              placeholder="you@youragency.co"
              value={email}
              maxLength={320}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary} ${styles.submit}`}
              disabled={!email.trim() || submitting}
            >
              {submitting ? "Joining…" : "Join the waitlist"}
            </button>

            {error && (
              <p className={`${styles.status} ${styles.bad}`} role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
