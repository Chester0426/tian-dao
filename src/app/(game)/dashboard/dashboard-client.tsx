"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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
import { OfflineRewardsDialog } from "./offline-rewards-dialog";
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
  const [showOfflineRewards, setShowOfflineRewards] = useState(false);
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

  // Show offline rewards dialog after mount
  useEffect(() => {
    setMounted(true);
    if (offlineRewards) {
      const timer = setTimeout(() => setShowOfflineRewards(true), 500);
      return () => clearTimeout(timer);
    }
  }, [offlineRewards]);

  const handleBreakthroughConfirm = useCallback(async () => {
    // Call breakthrough API
    try {
      await fetch("/api/game/breakthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Handle error silently for now
    }
  }, []);

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
  const inventorySlotPercent = totalSlots > 0 ? (slotsUsed / totalSlots) * 100 : 0;
  const inventoryNearFull = inventorySlotPercent >= 80;

  return (
    <TooltipProvider>
      <div className="min-h-screen ink-wash-bg ink-noise">
        {/* Atmospheric background layers */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-jade-dim blur-[120px] animate-[mist-drift_12s_ease-in-out_infinite]" />
          <div className="absolute right-1/3 bottom-1/3 h-64 w-64 rounded-full bg-cinnabar-dim blur-[100px] animate-[mist-drift_15s_ease-in-out_infinite_reverse]" />
          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-spirit-gold-dim blur-[140px] animate-[mist-drift_18s_ease-in-out_infinite]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header — brush-stroke reveal + decorative line */}
          <header className="mb-8" style={fadeSlide(0)}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  修煉總覽
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  修煉之路，永不停歇
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

          {/* Main Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* === Cultivation Status Card === */}
            <Card
              className={`md:col-span-1 scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                isBreakthroughReady ? "qi-glow" : ""
              }`}
              style={scaleReveal(1)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading text-xl">
                      {isPostBodyTempering ? (
                        <>
                          練體技能 <span className="text-jade text-glow-jade">Lv.{bodySkillLevel}</span>
                        </>
                      ) : (
                        <span className="text-glow-cinnabar">{stageName}</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isPostBodyTempering
                        ? "練體已圓滿，技能樹持續深化中"
                        : "身體深化 — 透過採礦與修煉獲得經驗"}
                    </CardDescription>
                  </div>
                  {isBreakthroughReady && (
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
                    <span className="text-muted-foreground">練體經驗</span>
                    <span className="font-heading tabular-nums text-foreground">
                      {formatNumber(xpCurrent)} / {formatNumber(xpRequired)}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cinnabar to-spirit-gold transition-all duration-700 ease-out"
                        style={{ width: `${xpProgress}%` }}
                      />
                      {xpProgress > 5 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-40"
                          style={{
                            width: `${xpProgress}%`,
                            background: "linear-gradient(90deg, transparent 60%, oklch(1 0 0 / 20%) 100%)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(xpProgress)}%
                    </span>
                    {isBreakthroughReady && (
                      <span className="text-xs font-medium text-spirit-gold animate-pulse text-glow-gold">
                        可以突破了！
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage progression visualization — larger touch targets */}
                <div className="flex items-center gap-1.5 py-2 flex-wrap">
                  {Array.from({ length: 9 }, (_, i) => {
                    const stage = i + 1;
                    const isActive = stage === profile.cultivation_stage;
                    const isCompleted = stage < profile.cultivation_stage;
                    return (
                      <Tooltip key={stage}>
                        <TooltipTrigger>
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-heading transition-all duration-200 cursor-default ${
                              isActive
                                ? "bg-cinnabar text-primary-foreground seal-glow scale-105 shadow-lg"
                                : isCompleted
                                  ? "bg-jade/15 text-jade border border-jade/30 hover:bg-jade/25"
                                  : "bg-muted/20 text-muted-foreground border border-border/30 hover:bg-muted/30"
                            }`}
                          >
                            {isCompleted ? "✓" : stage}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          練體{stage}階{" "}
                          {isActive
                            ? "(當前)"
                            : isCompleted
                              ? "(已通過)"
                              : "(未達成)"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* === Mining Skill Card — slide from right === */}
            <Card className="scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5" style={slideFromRight(2)}>
              <CardHeader>
                <CardTitle className="font-heading text-lg">採礦技能</CardTitle>
                <CardDescription>採礦等級與精通度</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mining level — large centered display */}
                <div className="flex flex-col items-center gap-1 rounded-lg border border-jade/15 bg-jade/5 py-4">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    技能等級
                  </span>
                  <span className="font-heading text-4xl font-bold text-jade text-glow-jade tabular-nums">
                    {miningSkill.level}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP</span>
                    <span className="tabular-nums">{formatNumber(miningSkill.xp)}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-jade/80 transition-all duration-500"
                      style={{ width: "35%" }}
                    />
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Mastery for depleted vein */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">枯竭礦脈 精通</span>
                    <span className="font-heading text-lg font-bold tabular-nums">
                      {depletedMastery?.level ?? 1}
                    </span>
                  </div>
                  {depletedMastery && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-spirit-gold/70 transition-all duration-500"
                        style={{ width: `${Math.min((depletedMastery.xp % 100), 100)}%` }}
                      />
                    </div>
                  )}
                  {!depletedMastery && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      開始採礦以獲得精通度
                    </p>
                  )}
                </div>

                <Link
                  href="/mining"
                  className={buttonVariants({
                    variant: "default",
                    size: "lg",
                    className: "w-full seal-glow hover:scale-[1.02] transition-transform font-heading mt-2",
                  })}
                >
                  前往礦場
                </Link>
              </CardContent>
            </Card>

            {/* === Inventory Summary Card === */}
            <Card className="scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-lg">背包</CardTitle>
                  <Badge
                    variant={inventoryNearFull ? "destructive" : "outline"}
                    className={`tabular-nums ${inventoryNearFull ? "" : "border-spirit-gold/30 text-spirit-gold bg-spirit-gold/5"}`}
                  >
                    {slotsUsed}/{totalSlots}
                  </Badge>
                </div>
                <CardDescription>{slotsUsed} / {totalSlots} 格已使用</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      inventoryNearFull ? "bg-destructive" : "bg-gradient-to-r from-jade/60 to-jade"
                    }`}
                    style={{ width: `${inventorySlotPercent}%` }}
                  />
                </div>
                <Link
                  href="/inventory"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full font-heading hover:border-jade/30 hover:text-jade",
                  })}
                >
                  查看背包
                </Link>
              </CardContent>
            </Card>

            {/* === Quick Actions Card — scroll-triggered, slide from right === */}
            <div
              ref={quickActionsReveal.ref}
              style={{
                opacity: quickActionsReveal.visible ? 1 : 0,
                transform: quickActionsReveal.visible ? "translateX(0)" : "translateX(24px)",
                transition: "all 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s",
              }}
            >
              <Card className="scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">快速操作</CardTitle>
                  <CardDescription>常用功能</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link
                    href="/mining"
                    className={buttonVariants({
                      variant: "outline",
                      className: "w-full justify-start gap-3 font-heading hover:bg-jade/10 hover:border-jade/30 hover:text-jade transition-colors",
                    })}
                  >
                    <span className="text-jade">⛏</span>
                    採礦 — 枯竭礦脈
                  </Link>

                  {isBreakthroughReady && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 font-heading hover:bg-spirit-gold/10 hover:border-spirit-gold/30 hover:text-spirit-gold transition-colors animate-pulse hover:animate-none"
                      onClick={() => setShowBreakthrough(true)}
                    >
                      <span className="text-spirit-gold">✨</span>
                      突破修煉
                    </Button>
                  )}

                  {isPostBodyTempering && (
                    <div className="rounded-lg border border-jade/20 bg-jade/5 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-jade">✓</span>
                        <span className="text-sm font-heading text-jade">
                          練體技能樹已解鎖
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        繼續採礦以提升練體技能等級 (1-99)
                      </p>
                    </div>
                  )}

                  {/* Game tip — ink wash styled quote */}
                  <div className="mt-4 rounded-lg bg-muted/15 border border-border/30 p-3 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cinnabar/40 via-cinnabar/20 to-transparent" />
                    <p className="pl-2 text-xs text-muted-foreground italic leading-relaxed">
                      「修仙之道，非一日之功。」— 離線時修煉仍在進行，最多累積 24 小時。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Offline Rewards Dialog */}
        {showOfflineRewards && offlineRewards && (
          <OfflineRewardsDialog
            rewards={offlineRewards}
            onDismiss={() => setShowOfflineRewards(false)}
          />
        )}

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
