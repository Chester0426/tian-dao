"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { trackActivate } from "@/lib/events";
import { useGameState } from "@/components/mining-provider";
import type { MineData } from "@/components/mining-provider";
import type { InventoryItem } from "@/lib/types";
import type { MineInfo } from "./page";
import { useI18n } from "@/lib/i18n";
import { ITEMS } from "@/lib/items";

// ---------------------------------------------------------------------------
// Item display (icon + rarity are language-independent, name uses i18n)
// ---------------------------------------------------------------------------

function getItemName(itemType: string, locale: string): string {
  const info = ITEMS[itemType];
  if (!info) return itemType;
  return locale === "en" ? info.nameEn : info.nameZh;
}

import { getMasteryDoubleDropChance, melvorXpForLevel } from "@/lib/types";

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

interface DropNotification {
  id: number;
  type: "drop" | "xp";
  icon: string;
  label: string;
  amount: number;
  total?: number;
  color: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Floating notifications component
// ---------------------------------------------------------------------------

function FloatingNotifications({ items }: { items: DropNotification[] }) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-1 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-lg bg-card/95 border border-border/50 px-3 py-1.5 text-sm backdrop-blur-sm shadow-lg"
          style={{ animation: "drop-float-up 2.5s ease-out forwards" }}
        >
          <span className={`text-base ${item.color}`}>{item.icon}</span>
          <span className={`font-bold tabular-nums ${item.color}`}>+{item.amount}</span>
          <span className="text-muted-foreground">{item.label}</span>
          {item.total !== undefined && (
            <span className="text-xs tabular-nums text-muted-foreground/60">{item.total.toLocaleString()}個</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface MiningPageClientProps {
  mines: MineInfo[];
  miningLevel: number;
  miningXp: number;
  miningXpMax: number;
  masteryLevels: Record<string, number>;
  masteryXps: Record<string, number>;
  masteryXpMaxs: Record<string, number>;
  inventory: InventoryItem[];
  inventorySlots: number;
  bodyStage: number;
  bodyXp: number;
  activeMineId: string | null;
  isDemo: boolean;
}

export function MiningPageClient({
  mines,
  miningLevel: initialLevel,
  miningXp: initialXp,
  miningXpMax: initialXpMax,
  masteryLevels: initialMasteryLevels,
  masteryXps: initialMasteryXps,
  masteryXpMaxs: initialMasteryXpMaxs,
  inventory: initialInventory,
  inventorySlots,
  activeMineId,
  isDemo,
}: MiningPageClientProps) {
  // Read all state from global provider — single source of truth
  const gameState = useGameState();
  const {
    isMining, activeMineId: activeMine, actionProgress,
    miningLevel, miningXp, miningXpMax,
    masteryLevels, masteryXps, masteryXpMaxs,
    inventory, startMining: globalStartMine, stopMining: globalStop,
  } = gameState;

  const { locale, t } = useI18n();
  const firedActivateRef = useRef(false);

  // Select mine and start mining
  const handleSelectMine = (mine: MineInfo) => {
    if (activeMine === mine.id && isMining) {
      globalStop();
      return;
    }

    globalStartMine({ id: mine.id, slug: mine.slug, xp_mining: mine.xp_mining, xp_mastery: mine.xp_mastery, xp_body: mine.xp_body, main_drop: mine.main_drop, companion_drops: mine.companion_drops, rock_base_hp: mine.rock_base_hp, respawn_seconds: mine.respawn_seconds });

    if (!firedActivateRef.current) {
      trackActivate({ action: "started_mining" });
      firedActivateRef.current = true;
    }
  };

  const xpPercent = miningXpMax > 0 ? Math.min((miningXp / miningXpMax) * 100, 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* === Header Bar === */}
        <header className="mb-6 -mx-6 md:-mx-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src="/images/nav-items/nav-mining.png" alt="" className="h-12 w-12 object-contain" />
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  {t("mining_title")}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "zh" ? "深入礦脈，採集天地靈石" : "Delve into mineral veins, harvest spiritual stones"}
              </p>
            </div>
            <Badge variant="outline" className="border-jade/40 bg-jade text-white font-heading px-3 py-1.5 text-sm">
              {t("mining_skillLevel")} {miningLevel}
            </Badge>
          </div>
          <div className="relative mt-4">
            <Separator />
          </div>
        </header>

        {/* Skill XP bar — spirit qi vein style with XP text */}
        <div className="mb-6 -mx-6 md:-mx-12">
          <div
            className="relative h-7 w-full overflow-hidden rounded-full"
            style={{
              background: "rgb(10,10,10)",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(xpPercent, 2)}%`,
                background: "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
                boxShadow: "0 0 8px rgba(62,207,165,0.5), 0 0 20px rgba(62,207,165,0.15)",
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)",
                }}
              />
            </div>
            {/* XP text centered over bar */}
            <div
              className="absolute inset-0 flex items-center justify-center gap-2 text-sm tabular-nums"
              style={{
                textShadow: "0 0 1px #000, 0 0 4px #000, 0 1px 6px rgba(0,0,0,0.9)",
                color: "#fff",
              }}
            >
              <span
                className="font-heading font-bold"
                style={{
                  color: "#fbbf24",
                  textShadow: "0 0 1px #000, 0 0 4px #000, 0 0 10px rgba(212,166,67,0.4), 0 1px 6px rgba(0,0,0,0.9)",
                }}
              >
                {t("mining_skillXp")}
              </span>
              <span className="font-bold">
                {miningXp.toLocaleString()} / {miningXpMax.toLocaleString()}
              </span>
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>({xpPercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* === Mine Grid === */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 auto-rows-fr">
          {mines.map((mine) => {
            const isLocked = miningLevel < mine.required_level;
            const isActive = activeMine === mine.id && isMining;
            const mastery = masteryLevels[mine.id] ?? 0;
            // Build display entries: main drop (100%) + companion drops
            const lootDisplayEntries = [
              { item_type: mine.main_drop, probability: 1.0 },
              ...mine.companion_drops.map((cd) => ({ item_type: cd.item, probability: cd.chance })),
            ];
            const circumference = 2 * Math.PI * 38; // SVG circle r=38

            // === LOCKED MINE CARD ===
            if (isLocked) {
              return (
                <div
                  key={mine.id}
                  className="rounded-xl border border-border/30 cursor-not-allowed flex items-center justify-center"
                  style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
                >
                  <div className="p-6 flex flex-col items-center gap-4">
                    <img src="/images/pickaxe.png" alt="" className="w-24 h-24 object-contain opacity-20" />
                    <div className="text-center space-y-1.5">
                      <p className="font-heading text-xl font-bold text-white/30">???</p>
                      <p className="text-sm text-white/20">
                        {locale === "zh" ? "未發現" : "Undiscovered"}
                      </p>
                      <p className="text-xs text-white/30">
                        {t("mining_needLevel", { n: mine.required_level })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            const mineMaxHp = mine.rock_base_hp + mastery;
            const savedHp = gameState.rockHpMap[mine.id];
            const currentRockHp = savedHp !== undefined ? Math.min(savedHp, mineMaxHp) : mineMaxHp;
            const currentRockMaxHp = mineMaxHp;
            const rockHpPct = currentRockMaxHp > 0 ? (currentRockHp / currentRockMaxHp) * 100 : 100;
            const masteryXpPct = masteryXpMaxs[mine.id] ? Math.min((masteryXps[mine.id] ?? 0) / masteryXpMaxs[mine.id] * 100, 100) : 0;

            return (
              <div
                key={mine.id}
                onClick={() => handleSelectMine(mine)}
                className={`rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                  isActive ? "border-jade/50 ring-1 ring-jade/30" : "border-border/30"
                }`}
                style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
              >
                <div className="p-3 space-y-2.5">
                  {/* Header: title */}
                  <div className="text-center">
                    <p className="font-heading text-base font-bold text-spirit-gold text-glow-gold">
                      {(locale === "zh" ? mine.name_zh : mine.name_en) ?? mine.name}
                    </p>
                  </div>

                  {/* Stat badges row */}
                  <div className="grid grid-cols-4 gap-1.5 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <TooltipProvider>
                      {([
                        { icon: "⛏️", value: String(mine.xp_mining), tip: locale === "zh" ? "挖礦經驗" : "Mining XP", color: "text-jade" },
                        { icon: "🏆", value: String(mine.xp_mastery), tip: locale === "zh" ? "精通經驗" : "Mastery XP", color: "text-cinnabar" },
                        { icon: "💪", value: String(mine.xp_body), tip: locale === "zh" ? "煉體經驗" : "Body XP", color: "text-spirit-gold" },
                        { icon: "⏱", value: "3.0s", tip: locale === "zh" ? "所需時間" : "Time Required", color: "text-white/60" },
                      ] as const).map((stat) => (
                        <Tooltip key={stat.tip}>
                          <TooltipTrigger>
                            <div className="flex flex-col items-center gap-1 py-1.5 cursor-default rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <span className={`${stat.color} text-base`}>{stat.icon}</span>
                              <span className="tabular-nums text-xs text-white/80">{stat.value}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{stat.tip}</TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>

                  {/* Ore image — shake + sparkle when mining (not during respawn) */}
                  {(() => { const isMiningActive = isActive && gameState.respawnProgress <= 0; return (
                  <div className="flex justify-center py-2 relative" style={isMiningActive ? { animation: 'mine-soft-shake 1s ease-in-out infinite' } : undefined}>
                    {ITEMS[mine.main_drop]?.image ? (
                      <img src={ITEMS[mine.main_drop].image} alt="" className="w-20 h-20 object-contain relative z-10" style={{ filter: isMiningActive ? "drop-shadow(0 0 8px rgba(212,166,67,0.5))" : "none" }} />
                    ) : (
                      <span className={`text-4xl relative z-10 ${ITEMS[mine.main_drop]?.color ?? "text-white/60"}`}>{ITEMS[mine.main_drop]?.icon ?? "⛏️"}</span>
                    )}
                    {isMiningActive && (
                      <>
                        <div className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full pointer-events-none" style={{ animation: 'bt-mine-spark 3s ease-out infinite', animationDelay: '0s' }} />
                        <div className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full pointer-events-none" style={{ animation: 'bt-mine-spark 3s ease-out infinite', animationDelay: '1s' }} />
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full pointer-events-none" style={{ animation: 'bt-mine-spark 3s ease-out infinite', animationDelay: '2s' }} />
                      </>
                    )}
                  </div>
                  ); })()}

                  {/* Rock HP bar — also shows respawn progress (filling back up) */}
                  <div className="space-y-1">
                    <p className="text-center text-xs tabular-nums text-white/60">
                      {isActive && gameState.respawnProgress > 0
                        ? `${Math.round(gameState.respawnProgress * currentRockMaxHp / 100)} / ${currentRockMaxHp}`
                        : `${currentRockHp} / ${currentRockMaxHp}`}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{
                          width: isActive && gameState.respawnProgress > 0
                            ? `${gameState.respawnProgress}%`
                            : `${rockHpPct}%`,
                          background: isActive && gameState.respawnProgress > 0
                            ? "linear-gradient(90deg, #92400e, #d97706, #fbbf24)"
                            : rockHpPct > 50
                              ? "linear-gradient(90deg, #dc2626, #f87171)"
                              : rockHpPct > 25
                                ? "linear-gradient(90deg, #d97706, #fbbf24)"
                                : "linear-gradient(90deg, #7f1d1d, #dc2626)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Mining action progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.4)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: isActive && gameState.respawnProgress <= 0 ? `${actionProgress}%` : "0%",
                        background: "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
                        boxShadow: isActive ? "0 0 6px rgba(62,207,165,0.5)" : "none",
                      }}
                    />
                  </div>

                  {/* Drop list */}
                  <div className="space-y-1">
                    {lootDisplayEntries.map((entry) => {
                      const info = ITEMS[entry.item_type];
                      return (
                        <div key={entry.item_type} className="flex items-center justify-between text-xs rounded px-2 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                          <div className="flex items-center gap-1.5">
                            {info?.image
                              ? <img src={info.image} alt="" className="h-4 w-4 object-contain" />
                              : <span className={info?.color ?? "text-white/70"}>{info?.icon ?? "○"}</span>}
                            <span className="text-white/70">{getItemName(entry.item_type, locale)}</span>
                          </div>
                          <span className="tabular-nums text-white/40">{entry.probability >= 1 ? "100%" : `${(entry.probability * 100).toFixed(0)}%`}</span>
                        </div>
                      );
                    })}
                  </div>


                  {/* Mastery */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-white/60">
                        🏆 <span className="font-bold text-cinnabar">{mastery}</span>
                      </span>
                      <span className="tabular-nums text-white/40">
                        {(masteryXps[mine.id] ?? 0).toLocaleString()} / {(masteryXpMaxs[mine.id] ?? 83).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.3)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${masteryXpPct}%`,
                          background: "linear-gradient(90deg, #1a4a3a, #3ecfa5)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notifications handled globally by GlobalGameUI in layout */}
    </div>
  );
}
