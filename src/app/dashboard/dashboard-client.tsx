"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
const ITEM_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  "\u7164": { name: "Coal", icon: "\u25C6", color: "text-ink-2" },
  "\u9285\u7926": { name: "Copper Ore", icon: "\u25C7", color: "text-spirit-gold" },
  "\u9748\u77F3\u7897\u7247": { name: "Spirit Stone", icon: "\u2726", color: "text-jade" },
};

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

  // Stagger animation delays for ink-fade-in
  const stagger = (index: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(12px)",
    filter: mounted ? "blur(0)" : "blur(4px)",
    transition: `all 0.5s ease-out ${index * 100}ms`,
  });

  const depletedMastery = masteries.find((m) => m.mine_id !== null) ?? null;
  const inventorySlotPercent = totalSlots > 0 ? (slotsUsed / totalSlots) * 100 : 0;
  const inventoryNearFull = inventorySlotPercent >= 80;

  return (
    <TooltipProvider>
      <div className="min-h-screen ink-wash-bg ink-noise">
        {/* Atmospheric background layers */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-jade-dim blur-[120px]" />
          <div className="absolute right-1/3 bottom-1/3 h-64 w-64 rounded-full bg-cinnabar-dim blur-[100px]" />
          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-spirit-gold-dim blur-[140px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8" style={stagger(0)}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  \u4FEE\u7149\u7E3D\u89BD
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  \u4FEE\u7149\u4E4B\u8DEF\uFF0C\u6C38\u4E0D\u505C\u6B47
                </p>
              </div>
              <Badge variant="outline" className="font-heading text-jade">
                {stageName}
              </Badge>
            </div>
            <Separator className="mt-4" />
          </header>

          {/* Main Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* === Cultivation Status Card === */}
            <Card
              className={`md:col-span-2 lg:col-span-2 scroll-surface transition-all duration-300 hover:shadow-lg ${
                isBreakthroughReady ? "qi-glow" : ""
              }`}
              style={stagger(1)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading text-xl">
                      {isPostBodyTempering ? (
                        <>
                          \u7DF4\u9AD4\u6280\u80FD <span className="text-jade">Lv.{bodySkillLevel}</span>
                        </>
                      ) : (
                        <span className="text-glow-cinnabar">{stageName}</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isPostBodyTempering
                        ? "\u7DF4\u9AD4\u5DF2\u5713\u6EFF\uFF0C\u6280\u80FD\u6A39\u6301\u7E8C\u6DF1\u5316\u4E2D"
                        : "\u8EAB\u9AD4\u6DF1\u5316 \u2014 \u900F\u904E\u63A1\u7926\u8207\u4FEE\u7149\u7372\u5F97\u7D93\u9A57"}
                    </CardDescription>
                  </div>
                  {isBreakthroughReady && (
                    <Button
                      onClick={() => setShowBreakthrough(true)}
                      className="seal-glow animate-pulse hover:animate-none hover:scale-[1.02] transition-transform font-heading"
                      size="lg"
                    >
                      \u7A81\u7834
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* XP Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">\u7DF4\u9AD4\u7D93\u9A57</span>
                    <span className="font-heading tabular-nums text-foreground">
                      {formatNumber(xpCurrent)} / {formatNumber(xpRequired)}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={xpProgress}>
                      <span className="sr-only">{Math.round(xpProgress)}%</span>
                    </Progress>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {Math.round(xpProgress)}%
                    </span>
                    {isBreakthroughReady && (
                      <span className="text-xs font-medium text-spirit-gold animate-pulse">
                        \u53EF\u4EE5\u7A81\u7834\u4E86\uFF01
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage progression visualization */}
                <div className="flex items-center gap-1 py-2">
                  {Array.from({ length: 9 }, (_, i) => {
                    const stage = i + 1;
                    const isActive = stage === profile.cultivation_stage;
                    const isCompleted = stage < profile.cultivation_stage;
                    return (
                      <Tooltip key={stage}>
                        <TooltipTrigger>
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-heading transition-all duration-200 cursor-default ${
                              isActive
                                ? "bg-cinnabar text-primary-foreground seal-glow scale-110"
                                : isCompleted
                                  ? "bg-jade/20 text-jade border border-jade/30"
                                  : "bg-muted/30 text-muted-foreground border border-border/50"
                            }`}
                          >
                            {stage}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          \u7DF4\u9AD4{stage}\u968E{" "}
                          {isActive
                            ? "(\u7576\u524D)"
                            : isCompleted
                              ? "(\u5DF2\u901A\u904E)"
                              : "(\u672A\u9054\u6210)"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* === Mining Skill Card === */}
            <Card className="scroll-surface transition-all duration-300 hover:shadow-lg" style={stagger(2)}>
              <CardHeader>
                <CardTitle className="font-heading text-lg">\u63A1\u7926\u6280\u80FD</CardTitle>
                <CardDescription>\u63A1\u7926\u7B49\u7D1A\u8207\u7CBE\u901A\u5EA6</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mining level */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    \u6280\u80FD\u7B49\u7D1A
                  </span>
                  <span className="font-heading text-2xl font-bold text-jade text-glow-jade tabular-nums">
                    {miningSkill.level}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP</span>
                    <span className="tabular-nums">{formatNumber(miningSkill.xp)}</span>
                  </div>
                  <Progress value={35}>
                    <span className="sr-only">Mining XP progress</span>
                  </Progress>
                </div>

                <Separator />

                {/* Mastery for depleted vein */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">\u67AF\u7AED\u7926\u8108 \u7CBE\u901A</span>
                    <span className="font-heading text-lg font-bold tabular-nums">
                      {depletedMastery?.level ?? 1}
                    </span>
                  </div>
                  {depletedMastery && (
                    <div className="mt-1 space-y-1">
                      <Progress value={Math.min((depletedMastery.xp % 100) * 100 / 100, 100)}>
                        <span className="sr-only">Mastery progress</span>
                      </Progress>
                    </div>
                  )}
                  {!depletedMastery && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      \u958B\u59CB\u63A1\u7926\u4EE5\u7372\u5F97\u7CBE\u901A\u5EA6
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
                  \u524D\u5F80\u7926\u5834
                </Link>
              </CardContent>
            </Card>

            {/* === Inventory Card === */}
            <Card
              className={`md:col-span-2 lg:col-span-2 scroll-surface transition-all duration-300 hover:shadow-lg ${
                inventoryNearFull ? "border-destructive/30" : ""
              }`}
              style={stagger(3)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading text-lg">\u80CC\u5305</CardTitle>
                    <CardDescription>
                      {slotsUsed} / {totalSlots} \u683C\u5DF2\u4F7F\u7528
                    </CardDescription>
                  </div>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant={inventoryNearFull ? "destructive" : "outline"}
                        className="tabular-nums"
                      >
                        {slotsUsed}/{totalSlots}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {inventoryNearFull
                        ? "\u80CC\u5305\u5373\u5C07\u6EFF\u4E86\uFF01\u8ACB\u6E05\u7406\u6216\u64F4\u5145\u3002"
                        : `\u5269\u9918 ${totalSlots - slotsUsed} \u683C\u53EF\u7528`}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                {/* Slot usage bar */}
                <div className="mb-4 space-y-1">
                  <Progress value={inventorySlotPercent}>
                    <span className="sr-only">{Math.round(inventorySlotPercent)}% inventory used</span>
                  </Progress>
                </div>

                {/* Item grid */}
                {inventory.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {inventory.map((item) => {
                      const display = ITEM_DISPLAY[item.item_type];
                      return (
                        <Tooltip key={item.id || item.item_type}>
                          <TooltipTrigger>
                            <div className="group flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-3 transition-all duration-150 hover:bg-secondary/40 hover:shadow-sm hover:-translate-y-0.5 cursor-default">
                              <span
                                className={`text-xl leading-none ${display?.color ?? "text-foreground"}`}
                              >
                                {display?.icon ?? "\u25CB"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {item.item_type}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  x{formatNumber(item.quantity)}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.item_type}{" "}
                            {display?.name ? `(${display.name})` : ""} \u2014{" "}
                            {formatNumber(item.quantity)} \u500B
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
                      <span className="text-2xl text-muted-foreground">\u5305</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      \u80CC\u5305\u7A7A\u7A7A\u5982\u4E5F
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      \u524D\u5F80\u7926\u5834\u958B\u59CB\u63A1\u96C6\u8CC7\u6E90
                    </p>
                    <Link
                      href="/mining"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "mt-4 font-heading",
                      })}
                    >
                      \u524D\u5F80\u63A1\u7926
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* === Quick Actions Card === */}
            <Card className="scroll-surface transition-all duration-300 hover:shadow-lg" style={stagger(4)}>
              <CardHeader>
                <CardTitle className="font-heading text-lg">\u5FEB\u901F\u64CD\u4F5C</CardTitle>
                <CardDescription>\u5E38\u7528\u529F\u80FD</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/mining"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full justify-start gap-3 font-heading hover:bg-jade/10 hover:border-jade/30 hover:text-jade transition-colors",
                  })}
                >
                  <span className="text-jade">\u26CF</span>
                  \u63A1\u7926 \u2014 \u67AF\u7AED\u7926\u8108
                </Link>

                {isBreakthroughReady && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 font-heading hover:bg-spirit-gold/10 hover:border-spirit-gold/30 hover:text-spirit-gold transition-colors animate-pulse hover:animate-none"
                    onClick={() => setShowBreakthrough(true)}
                  >
                    <span className="text-spirit-gold">\u2728</span>
                    \u7A81\u7834\u4FEE\u7149
                  </Button>
                )}

                {isPostBodyTempering && (
                  <div className="rounded-lg border border-jade/20 bg-jade/5 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-jade">\u2713</span>
                      <span className="text-sm font-heading text-jade">
                        \u7DF4\u9AD4\u6280\u80FD\u6A39\u5DF2\u89E3\u9396
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      \u7E7C\u7E8C\u63A1\u7926\u4EE5\u63D0\u5347\u7DF4\u9AD4\u6280\u80FD\u7B49\u7D1A (1-99)
                    </p>
                  </div>
                )}

                {/* Game tip */}
                <div className="mt-4 rounded-lg bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground italic">
                    \u300C\u4FEE\u4ED9\u4E4B\u9053\uFF0C\u975E\u4E00\u65E5\u4E4B\u529F\u3002\u300D\u2014 \u96E2\u7DDA\u6642\u4FEE\u7149\u4ECD\u5728\u9032\u884C\uFF0C\u6700\u591A\u7D2F\u7A4D 24 \u5C0F\u6642\u3002
                  </p>
                </div>
              </CardContent>
            </Card>
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
