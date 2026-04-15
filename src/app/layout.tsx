import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix — Clinical Workflow OS",
  description: "Helix is a clinical workflow operating system for hospitals, managing staff, schedules, duty coverage, patients, and escalation protocols.",
  icons: {
    icon: "/helix-logo.png",
    shortcut: "/helix-logo.png",
    apple: "/helix-logo.png",
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
