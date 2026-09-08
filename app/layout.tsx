import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "./components/AppNav";
import { AuthProvider } from "./components/AuthProvider";

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
          <AppNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
