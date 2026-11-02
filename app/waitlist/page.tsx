import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { landingMode } from "@/lib/landing";
import { Landing } from "./Landing";

/**
 * The public landing page. In waitlist mode the launch gate serves it as "/".
 *
 * A server component for one reason: it reads LAUNCH_MODE, which is a server
 * env var and never reaches the browser. The page itself is the client
 * component below; this only tells it which mode it is in.
 *
 * Dynamic, so the mode is read per request like the gate reads it, rather than
 * frozen into a static page at build time.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quotient. Price every client from their own numbers",
  description:
    "Pricing, proposals and onboarding docs for AI and automation agencies, built from what the automation recovers for each client.",
};

/* Self-hosted by next/font at build time: no request to Google from the
   visitor's browser, and no layout shift while the font loads. Scoped to this
   page through CSS variables, so the app's own type is untouched. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function WaitlistPage() {
  return (
    <Landing
      mode={landingMode(process.env.LAUNCH_MODE)}
      fontClassName={`${jakarta.variable} ${plexMono.variable}`}
    />
  );
}
