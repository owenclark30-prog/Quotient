import type { Metadata } from "next";
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

const TITLE = "Worthmark. Price every client from their own numbers";
const DESCRIPTION =
  "Pricing, proposals and onboarding docs for AI and automation agencies, built from what the automation recovers for each client.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The canonical address is the front door, whichever path served it.
  alternates: { canonical: "/" },
  // Next replaces these objects rather than merging them with the layout's,
  // so each is restated whole.
  openGraph: {
    type: "website",
    siteName: "Worthmark",
    locale: "en_GB",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default function WaitlistPage() {
  return <Landing mode={landingMode(process.env.LAUNCH_MODE)} />;
}
