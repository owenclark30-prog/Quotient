"use client";

import { useState } from "react";
import { joinWaitlist } from "@/lib/data/waitlist";
import { errorMessage } from "@/lib/errors";
import styles from "./waitlist.module.css";

/** Public. Deliberately not wrapped in RequireAuth — this is the one page in
 * the app anyone can reach, and it reads nothing. */
export default function WaitlistPage() {
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
    <main className={styles.page}>
      <div className={styles.glow}>
        <h1 className={styles.mark}>Quotient.</h1>

        <p className={styles.headline}>
          Everything your automation agency runs on.
        </p>

        <p className={styles.subhead}>
          Built by an agency owner who didn&rsquo;t know how to price a client,
          write a proposal, or run onboarding properly when he started — so he
          built the tool that does it for you.
        </p>
      </div>

      <div className={styles.lines}>
        <p className={styles.feature}>
          Built and being tested right now. Full access opens to the first 25
          members.
        </p>
        <p className={styles.secondary}>
          More coming: pipeline tracking, prospecting tools, and the rest of the
          system agencies need to run.
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.offer}>
          Join the waitlist — first 25 members get founder pricing at{" "}
          <strong>£29/mo</strong>, locked forever.
        </p>

        {joined ? (
          <p className={`${styles.status} ${styles.ok}`}>
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

            <label htmlFor="waitlist-email" className={styles.srOnly}>
              Email address
            </label>
            <input
              id="waitlist-email"
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
              className={`button-primary ${styles.submit}`}
              disabled={!email.trim() || submitting}
            >
              {submitting ? "Joining…" : "Join the waitlist"}
            </button>

            {error && (
              <p className={`${styles.status} ${styles.bad}`}>{error}</p>
            )}
          </form>
        )}
      </div>

      <p className={styles.footer}>Quotient. — for automation agencies.</p>
    </main>
  );
}
