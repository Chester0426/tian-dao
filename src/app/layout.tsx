import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { NavBar } from "@/components/nav-bar";
import { RetainTracker } from "@/components/RetainTracker";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assayer - Idea Verdict Machine",
  description:
    "Paste your idea. Get a live experiment and a data-backed SCALE/REFINE/PIVOT/KILL verdict in days.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NavBar />
        <RetainTracker />
        {children}
      </body>
    </html>
  );
}
