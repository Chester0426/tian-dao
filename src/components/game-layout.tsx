"use client";

import { useState, useCallback, useEffect } from "react";
import { GameSidebar } from "./game-sidebar";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab ?? "dashboard");
  const [loading, setLoading] = useState(true);

  // Preload all background images + mount all tabs
  useEffect(() => {
    const urls = Object.values(TAB_BG).flatMap(bg => [bg.pc, bg.mobile]);
    let loaded = 0;
    const total = urls.length;
    const checkDone = () => {
      loaded++;
      if (loaded >= total) setLoading(false);
    };
    urls.forEach(src => {
      const img = new window.Image();
      img.onload = checkDone;
      img.onerror = checkDone;
      img.src = src;
    });
    // Fallback: max 3s loading
    setTimeout(() => setLoading(false), 3000);
  }, []);

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
        {/* Loading screen */}
        {loading && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
            <img src="/images/logo-dao.png" alt="天道" className="h-24 w-24 rounded-xl mb-6" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <p className="font-heading text-lg text-spirit-gold tracking-widest">天 道</p>
            <div className="mt-4 w-32 h-1 rounded-full bg-muted/30 overflow-hidden">
              <div className="h-full bg-spirit-gold/60 rounded-full" style={{ animation: "loading-bar 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        )}
        {TAB_KEYS.map(tab => {
          const Page = PAGES[tab];
          return (
            <div key={tab} style={{ display: tab === activeTab && !loading ? "block" : "none" }}>
              <Page />
            </div>
          );
        })}
      </main>
    </div>
  );
}
