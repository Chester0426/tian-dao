"use client";

import { useState, useCallback } from "react";
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
};

const TAB_KEYS = Object.keys(PAGES);

export function GameLayout({
  isAdmin = false,
  initialTab = "dashboard",
}: {
  children?: React.ReactNode;
  isAdmin?: boolean;
  initialTab?: string;
}) {
  const tabFromUrl = typeof window !== "undefined"
    ? window.location.pathname.replace("/", "").split("/")[0] || "dashboard"
    : initialTab;
  const resolvedTab = tabFromUrl && Object.keys(PAGES).includes(tabFromUrl) ? tabFromUrl : (initialTab ?? "dashboard");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(resolvedTab);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([resolvedTab]));

  const switchTab = useCallback((tab: string) => {
    setActiveTab(tab);
    setMountedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    window.history.replaceState(null, "", `/${tab}`);
  }, []);

  return (
    <div className="flex min-h-screen ink-wash-bg ink-noise">
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
        {TAB_KEYS.map(tab => {
          if (!mountedTabs.has(tab)) return null;
          const Page = PAGES[tab];
          return (
            <div key={tab} style={{ display: tab === activeTab ? "block" : "none" }}>
              <Page />
            </div>
          );
        })}
      </main>
    </div>
  );
}
