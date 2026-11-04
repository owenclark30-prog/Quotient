import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { AppNav } from "./components/AppNav";
import { AuthProvider } from "./components/AuthProvider";
import { SubscriptionProvider } from "./components/SubscriptionProvider";

const DESCRIPTION =
  "Pricing, proposals and onboarding docs for AI and automation agencies, built from what the automation recovers for each client.";

export const metadata: Metadata = {
  // Absolute base for the Open Graph and canonical URLs Next derives below.
  metadataBase: new URL(siteUrl()),
  title: "Worthmark",
  description: DESCRIPTION,
  applicationName: "Worthmark",
  openGraph: {
    type: "website",
    siteName: "Worthmark",
    title: "Worthmark",
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: "Worthmark",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#02070A",
};

/* Self-hosted by next/font at build time: the files are served from this site,
   so a visitor's browser never asks Google for anything, and there is no layout
   shift while they load. Exposed as CSS variables; globals.css decides where
   each is used. */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AuthProvider>
          {/* Inside AuthProvider: it needs the session before it can load a
              subscription, and both are read by RequireAuth. */}
          <SubscriptionProvider>
            <AppNav />
            {children}
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
