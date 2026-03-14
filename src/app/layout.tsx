import type { Metadata } from "next";
import { DM_Serif_Display, IBM_Plex_Sans } from "next/font/google";
import { NavBar } from "@/components/nav-bar";
import { RetainTracker } from "@/components/RetainTracker";
import "./globals.css";

const displayFont = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif-display",
  display: "swap",
});

const bodyFont = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assayer — Validate startup ideas with data-backed verdicts",
  description:
    "Paste an idea, watch AI generate a testable spec, deploy a live experiment, and receive a SCALE/REFINE/PIVOT/KILL verdict in days.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NavBar />
        <RetainTracker />
        <main>{children}</main>
      </body>
    </html>
  );
}
