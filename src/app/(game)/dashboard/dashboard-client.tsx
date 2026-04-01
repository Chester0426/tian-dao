"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameState } from "@/components/mining-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trackActivate, trackRetainReturn } from "@/lib/events";
import type { Profile, MiningSkill, MineMastery, InventoryItem } from "@/lib/types";
import { BreakthroughDialog } from "./breakthrough-dialog";

// -- Item display data --

/** Hook: observe element entering viewport for scroll-triggered reveals */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

interface OfflineRewards {
  minutesAway: number;
  drops: { item_type: string; quantity: number }[];
  xpGained: { mining: number; mastery: number; body: number };
  bodyProgress: string;
}

interface DashboardClientProps {
  profile: Profile;
  miningSkill: MiningSkill;
  masteries: MineMastery[];
  inventory: InventoryItem[];
  offlineRewards: OfflineRewards | null;
  stageName: string;
  xpProgress: number;
  xpCurrent: number;
  xpRequired: number;
  isBreakthroughReady: boolean;
  slotsUsed: number;
  totalSlots: number;
  isPostBodyTempering: boolean;
  bodySkillLevel: number;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function DashboardClient({
  profile,
  miningSkill,
  masteries,
  inventory,
  offlineRewards,
  stageName,
  xpProgress,
  xpCurrent,
  xpRequired,
  isBreakthroughReady,
  slotsUsed,
  totalSlots,
  isPostBodyTempering,
  bodySkillLevel,
}: DashboardClientProps) {
  const router = useRouter();
  const gameState = useGameState();

  // Use global real-time values (updates while mining on other pages)
  const liveBodyXp = gameState.bodyXp ?? xpCurrent;
  const liveMiningLevel = gameState.miningLevel ?? miningSkill.level;
  const liveMiningXp = gameState.miningXp ?? 0;
  const liveMiningXpMax = gameState.miningXpMax ?? 100;
  const liveInventory = gameState.inventory.length > 0 ? gameState.inventory : inventory;
  const liveSlotsUsed = new Set(liveInventory.map((i) => i.item_type)).size;

  // For stage 10 (demo cap), don't show breakthrough
  const isDemoCap = profile.cultivation_stage >= 10;
  const liveXpProgress = isDemoCap ? 100 : (xpRequired > 0 ? Math.min((liveBodyXp / xpRequired) * 100, 100) : xpProgress);
  const liveBreakthroughReady = !isDemoCap && liveXpProgress >= 100 && profile.cultivation_stage <= 9;

  const [showBreakthrough, setShowBreakthrough] = useState(false);
  const [hasTrackedActivate, setHasTrackedActivate] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fire activate event on first dashboard visit
  useEffect(() => {
    if (!hasTrackedActivate) {
      const hasVisited = localStorage.getItem("xian_dashboard_visited");
      if (!hasVisited) {
        trackActivate({ action: "entered_dashboard" });
        localStorage.setItem("xian_dashboard_visited", "true");
      }
      setHasTrackedActivate(true);
    }
  }, [hasTrackedActivate]);

  // Fire retain_return if returning after 24h+
  useEffect(() => {
    try {
      const lastVisit = localStorage.getItem("xian_last_dashboard_visit");
      if (lastVisit) {
        const days = Math.floor(
          (Date.now() - Number(lastVisit)) / 86_400_000
        );
        if (days >= 1) {
          trackRetainReturn({ days_since_last: days });
        }
      }
      localStorage.setItem("xian_last_dashboard_visit", String(Date.now()));
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBreakthroughConfirm = useCallback(async () => {
    try {
      const res = await fetch("/api/game/breakthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Refresh page to show new stage
        router.refresh();
      }
    } catch {
      // Handle error silently for now
    }
  }, [router]);

  // Diverse animation styles to avoid monotony
  const fadeSlide = (index: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(12px)",
    filter: mounted ? "blur(0)" : "blur(4px)",
    transition: `all 0.5s ease-out ${index * 100}ms`,
  });

  const scaleReveal = (index: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1)" : "scale(0.96)",
    transition: `all 0.45s cubic-bezier(0.22,1,0.36,1) ${index * 120}ms`,
  });

  const slideFromRight = (index: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateX(0)" : "translateX(20px)",
    transition: `all 0.5s ease-out ${index * 100}ms`,
  });

  // Scroll reveal hooks for below-fold cards
  const quickActionsReveal = useScrollReveal(0.1);

  const depletedMastery = masteries.find((m) => m.mine_id !== null) ?? null;
  const inventorySlotPercent = totalSlots > 0 ? (liveSlotsUsed / totalSlots) * 100 : 0;
  const inventoryNearFull = inventorySlotPercent >= 80;

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Header — brush-stroke reveal + decorative line */}
          <header className="mb-6" style={fadeSlide(0)}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  煉體
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  透過挖礦與修煉突破境界
                </p>
              </div>
              <Badge variant="outline" className="font-heading text-jade border-jade/30 bg-jade/5 px-3 py-1.5 text-sm">
                {stageName}
              </Badge>
            </div>
            {/* Decorative brush-stroke separator */}
            <div className="relative mt-4">
              <Separator />
              <div
                className="absolute left-0 top-0 h-[2px] bg-gradient-to-r from-cinnabar via-spirit-gold to-transparent"
                style={{
                  width: mounted ? "40%" : "0%",
                  transition: "width 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s",
                }}
              />
            </div>
          </header>

          {/* Cultivation only */}
          <div className="grid gap-6">
            {/* === Cultivation Status Card === */}
            <Card
              className={`scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                liveBreakthroughReady ? "qi-glow" : ""
              }`}
              style={scaleReveal(1)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading text-lg">
                      {isPostBodyTempering ? (
                        <>
                          煉體技能 <span className="text-jade text-glow-jade">Lv.{bodySkillLevel}</span>
                        </>
                      ) : (
                        <span className="text-glow-cinnabar">{stageName}</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isPostBodyTempering
                        ? "煉體已圓滿，技能樹持續深化中"
                        : "身體深化 — 透過挖礦與修煉獲得經驗"}
                    </CardDescription>
                  </div>
                  {liveBreakthroughReady && (
                    <Button
                      onClick={() => setShowBreakthrough(true)}
                      className="seal-glow animate-pulse hover:animate-none hover:scale-[1.02] transition-transform font-heading"
                      size="lg"
                    >
                      突破
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* XP Progress — custom themed bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">煉體經驗</span>
                    <span className="font-heading tabular-nums text-foreground">
                      {formatNumber(liveBodyXp)} / {formatNumber(xpRequired)}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cinnabar to-spirit-gold transition-all duration-700 ease-out"
                        style={{ width: `${liveXpProgress}%` }}
                      />
                      {liveXpProgress > 5 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-40"
                          style={{
                            width: `${liveXpProgress}%`,
                            background: "linear-gradient(90deg, transparent 60%, oklch(1 0 0 / 20%) 100%)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(liveXpProgress)}%
                    </span>
                    {liveBreakthroughReady && (
                      <span className="text-xs font-medium text-spirit-gold animate-pulse text-glow-gold">
                        可以突破了！
                      </span>
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Mining skill, inventory, quick actions removed — only cultivation here */}
          </div>
        </div>

        {/* Offline rewards handled globally by GlobalGameUI */}

        {/* Breakthrough Dialog */}
        {showBreakthrough && (
          <BreakthroughDialog
            currentStage={profile.cultivation_stage}
            onConfirm={handleBreakthroughConfirm}
            onCancel={() => setShowBreakthrough(false)}
          />
        )}
      </div>

    </TooltipProvider>
  );
}
