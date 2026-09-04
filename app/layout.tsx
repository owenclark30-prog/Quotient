import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
