import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "./components/AppNav";
import { AuthProvider } from "./components/AuthProvider";
import { SubscriptionProvider } from "./components/SubscriptionProvider";

export const metadata: Metadata = {
  title: "Quotient",
  description: "Pricing and proposal calculator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
