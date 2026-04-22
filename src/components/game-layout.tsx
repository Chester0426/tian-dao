"use client";

import { useState, useCallback, useEffect } from "react";
import { GameSidebar } from "./game-sidebar";
import { useGameState } from "./mining-provider";
import { useI18n } from "@/lib/i18n";

// Direct imports — all loaded upfront for instant tab switching
import DashboardPage from "@/app/(game)/dashboard/page-client";
import StatsPage from "@/app/(game)/stats/page";
import AdventurePage from "@/app/(game)/adventure/page";
import MiningPage from "@/app/(game)/mining/page-client";
import InventoryPage from "@/app/(game)/inventory/page";
import EnlightenmentPage from "@/app/(game)/enlightenment/page-client";
import FeedbackPage from "@/app/(game)/feedback/page";
import ShopPage from "@/app/(game)/shop/page-client";
import DungeonPage from "@/app/(game)/dungeon/page";
import HerbalismPage from "@/app/(game)/herbalism/page";
import AlchemyPage from "@/app/(game)/alchemy/page";
import CookingPage from "@/app/(game)/cooking/page";
import FishingPage from "@/app/(game)/fishing/page";
import SmithingPage from "@/app/(game)/smithing/page";
import MarketPage from "@/app/(game)/market/page";
import LeaderboardPage from "@/app/(game)/leaderboard/page";

const PAGES: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  stats: StatsPage,
  adventure: AdventurePage,
  mining: MiningPage,
  inventory: InventoryPage,
  enlightenment: EnlightenmentPage,
  feedback: FeedbackPage,
  shop: ShopPage,
  dungeon: DungeonPage,
  herbalism: HerbalismPage,
  alchemy: AlchemyPage,
  cooking: CookingPage,
  fishing: FishingPage,
  smithing: SmithingPage,
  market: MarketPage,
  leaderboard: LeaderboardPage,
};

const TAB_KEYS = Object.keys(PAGES);

// Tab background images mapping (pc, mobile)
const TAB_BG: Record<string, { pc: string; mobile: string }> = {
  shop: { pc: "/images/bg-shop.png", mobile: "/images/bg-shop-m.png" },
  market: { pc: "/images/bg-market.png", mobile: "/images/bg-market-m.png" },
  inventory: { pc: "/images/bg-inventory.png", mobile: "/images/bg-inventory-m.png" },
  leaderboard: { pc: "/images/bg-leaderboard.png", mobile: "/images/bg-leaderboard-m.png" },
  dashboard: { pc: "/images/bg-dashboard.png", mobile: "/images/bg-dashboard-m.png" },
  stats: { pc: "/images/bg-stats.png", mobile: "/images/bg-stats-m.png" },
  enlightenment: { pc: "/images/bg-enlightenment.png", mobile: "/images/bg-enlightenment-m.png" },
  adventure: { pc: "/images/bg-adventure.png", mobile: "/images/bg-adventure-m.png" },
  dungeon: { pc: "/images/bg-dungeon.png", mobile: "/images/bg-dungeon-m.png" },
  mining: { pc: "/images/bg-mining.png", mobile: "/images/bg-mining-m.png" },
  herbalism: { pc: "/images/bg-herbalism.png", mobile: "/images/bg-herbalism-m.png" },
  alchemy: { pc: "/images/bg-alchemy.png", mobile: "/images/bg-alchemy-m.png" },
  smithing: { pc: "/images/bg-smithing.png", mobile: "/images/bg-smithing-m.png" },
  feedback: { pc: "/images/bg-feedback.png", mobile: "/images/bg-feedback-m.png" },
};

export function GameLayout({
  isAdmin = false,
  initialTab = "dashboard",
}: {
  children?: React.ReactNode;
  isAdmin?: boolean;
  initialTab?: string;
}) {
  const gameState = useGameState();
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab ?? "dashboard");
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Preload all background images + mount all tabs
  useEffect(() => {
    const urls = Object.values(TAB_BG).flatMap(bg => [bg.pc, bg.mobile]);
    let loaded = 0;
    const total = urls.length;
    const startTime = Date.now();
    const MIN_SPLASH_MS = 3000;

    const checkDone = () => {
      loaded++;
      setLoadProgress(Math.round((loaded / total) * 100));
      if (loaded >= total) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => setReady(true), remaining);
      }
    };
    urls.forEach(src => {
      const img = new window.Image();
      img.onload = checkDone;
      img.onerror = checkDone;
      img.src = src;
    });
    // Fallback: max 5s
    setTimeout(() => setReady(true), 5000);
  }, []);

  // Auto-enter when ready
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      setEntered(true);
      gameState.setHasEntered(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve tab from URL on client only — avoids hydration mismatch
  useEffect(() => {
    const urlTab = window.location.pathname.replace("/", "").split("/")[0] || "dashboard";
    const resolved = Object.keys(PAGES).includes(urlTab) ? urlTab : (initialTab ?? "dashboard");
    setActiveTab(resolved);
  }, [initialTab]);

  const switchTab = useCallback((tab: string) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/${tab}`);
  }, []);

  const currentBg = TAB_BG[activeTab];

  return (
    <div className="flex min-h-screen ink-wash-bg ink-noise relative">
      {/* Dynamic page background */}
      {currentBg && (
        <>
          <div
            className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500 md:block hidden"
            style={{ backgroundImage: `url('${currentBg.pc}')`, opacity: 0.3 }}
          />
          <div
            className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500 md:hidden block"
            style={{ backgroundImage: `url('${currentBg.mobile}')`, opacity: 0.3 }}
          />
        </>
      )}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <GameSidebar
        open={sidebarOpen}
        onCloseAction={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        activeTab={activeTab}
        onTabChangeAction={switchTab}
      />

      <main className="flex-1 md:ml-56 lg:ml-60">
        <div className="sticky top-0 z-20 flex h-12 items-center border-b border-border/30 bg-card/80 backdrop-blur-sm px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="開啟選單"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 4.5h12M3 9h12M3 13.5h12" />
            </svg>
          </button>
          <span className="ml-3 font-heading text-sm font-bold">天道</span>
        </div>
        {/* Loading screen — xianxia cultivation entrance */}
        {!entered && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
            {/* Outer qi circle — rotating rune marks */}
            <svg className="absolute" width="280" height="280" viewBox="0 0 280 280" style={{ animation: "dao-ring-rotate 20s linear infinite" }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i * 45 * Math.PI) / 180;
                return <line key={i} x1={140 + 128 * Math.cos(a)} y1={140 + 128 * Math.sin(a)} x2={140 + 135 * Math.cos(a)} y2={140 + 135 * Math.sin(a)} stroke="#d4a643" strokeWidth="1.5" opacity="0.25" />;
              })}
              <circle cx="140" cy="140" r="132" fill="none" stroke="#d4a643" strokeWidth="0.5" opacity="0.15" strokeDasharray="4 10" />
            </svg>
            {/* Counter-rotating inner ring */}
            <svg className="absolute" width="280" height="280" viewBox="0 0 280 280" style={{ animation: "dao-ring-rotate-reverse 15s linear infinite" }}>
              <circle cx="140" cy="140" r="122" fill="none" stroke="#d4a643" strokeWidth="0.3" opacity="0.12" strokeDasharray="2 14" />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                return <circle key={i} cx={140 + 122 * Math.cos(a)} cy={140 + 122 * Math.sin(a)} r="1" fill="#d4a643" opacity="0.2" />;
              })}
            </svg>
            {/* Pulsing qi aura */}
            <div className="absolute w-48 h-48 rounded-full pointer-events-none" style={{
              background: "radial-gradient(circle, oklch(0.78 0.155 80 / 12%) 0%, oklch(0.78 0.155 80 / 4%) 50%, transparent 70%)",
              animation: "qi-aura-pulse 2.5s ease-in-out infinite",
            }} />
            {/* Logo */}
            <img src="/images/logo-dao.png" alt="天道" className="relative z-10 h-20 w-20 rounded-xl mb-5" style={{
              filter: "drop-shadow(0 0 12px rgba(212,166,67,0.4))",
              animation: "pulse 2.5s ease-in-out infinite",
            }} />
            {/* Title */}
            <p className="relative z-10 font-heading text-xl text-spirit-gold tracking-[0.3em] mb-8 text-glow-gold">
              {isZh ? "天 道" : "TIAN DAO"}
            </p>
            {/* Circular progress ring with percentage */}
            <div className="relative z-10 w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(212,166,67,0.12)" strokeWidth="2.5" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="url(#splash-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - loadProgress / 100)}`}
                  style={{
                    filter: "drop-shadow(0 0 4px rgba(212,166,67,0.6))",
                    transition: "stroke-dashoffset 0.3s ease-out",
                  }}
                />
                <defs>
                  <linearGradient id="splash-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d4a643" />
                    <stop offset="100%" stopColor="#f0d080" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Center percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs tabular-nums text-spirit-gold/70 font-heading">{loadProgress}%</span>
              </div>
            </div>
            {/* Status text */}
            <p className="relative z-10 mt-5 text-xs text-spirit-gold/50 font-heading tracking-widest">
              {ready ? (isZh ? "靈氣匯聚" : "Qi Gathered") : (isZh ? "引氣入體" : "Channeling Qi")}
            </p>
          </div>
        )}
        {TAB_KEYS.map(tab => {
          const Page = PAGES[tab];
          return (
            <div key={tab} style={{ display: tab === activeTab && entered ? "block" : "none" }}>
              <Page />
            </div>
          );
        })}
      </main>
    </div>
  );
}
