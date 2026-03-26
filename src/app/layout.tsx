import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { RetainTracker } from "@/components/RetainTracker";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "仙途放置 — 掛機也能登仙 | Xian Idle",
  description:
    "修仙主題放置 RPG：挖礦、修煉、突破境界，24 小時不停歇。你的資源，未來可上鏈交易。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSerifSC.variable} ${notoSansSC.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NavBar />
        <RetainTracker />
        {children}
      </body>
    </html>
  );
}
