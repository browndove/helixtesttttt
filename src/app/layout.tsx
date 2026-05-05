import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix — Clinical Workflow OS",
  description: "Helix is a clinical workflow operating system for hospitals, managing staff, schedules, duty coverage, patients, and escalation protocols.",
  icons: {
    icon: "/brand-logo.svg",
    shortcut: "/brand-logo.svg",
    apple: "/brand-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}<Analytics /></body>
    </html>
  );
}
