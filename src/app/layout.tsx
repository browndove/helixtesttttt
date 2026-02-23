import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix — Clinical Workflow OS",
  description: "Helix is a clinical workflow operating system for hospitals, managing staff, schedules, duty coverage, patients, and escalation protocols.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
