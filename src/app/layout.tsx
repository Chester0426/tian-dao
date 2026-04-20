import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, Ma_Shan_Zheng } from "next/font/google";
import "./globals.css";
import { RetainTracker } from "@/components/RetainTracker";
import { Web3Provider } from "@/components/web3-provider";
import { I18nProvider } from "@/lib/i18n";
import { BgmPlayer } from "@/components/bgm-player";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

const maShanZheng = Ma_Shan_Zheng({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-brush",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "天道 — 掛機也能登仙 | Tian Tao",
  description:
    "一念成道 — 修仙主題放置 RPG，掛機也能登仙",
  icons: {
    icon: "/images/favicon.png",
  },
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
      <body className={`min-h-screen bg-background font-sans text-foreground antialiased ${maShanZheng.variable}`}>
        <RetainTracker />
        <BgmPlayer />
        <I18nProvider>
          <Web3Provider>
            {children}
          </Web3Provider>
        </I18nProvider>
      </body>
    </html>
  );
}
