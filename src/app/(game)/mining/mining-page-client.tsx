"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trackActivate } from "@/lib/events";
import { useGameState } from "@/components/mining-provider";
import type { MineData } from "@/components/mining-provider";
import type { InventoryItem } from "@/lib/types";
import type { MineInfo } from "./page";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Item display (icon + rarity are language-independent, name uses i18n)
// ---------------------------------------------------------------------------

const ITEM_META: Record<string, { icon: string; rarity: "common" | "uncommon" | "rare"; zhName: string; enName: string }> = {
  coal: { icon: "◆", rarity: "common", zhName: "煤", enName: "Coal" },
  copper_ore: { icon: "◇", rarity: "uncommon", zhName: "銅礦", enName: "Copper Ore" },
  spirit_stone_fragment: { icon: "✦", rarity: "rare", zhName: "靈石碎片", enName: "Spirit Stone" },
};

function getItemName(itemType: string, locale: string): string {
  const meta = ITEM_META[itemType];
  if (!meta) return itemType;
  return locale === "en" ? meta.enName : meta.zhName;
}

// Mine names
const MINE_NAMES: Record<string, { zh: string; en: string }> = {
  depleted_vein: { zh: "枯竭礦脈", en: "Depleted Vein" },
  red_copper_vein: { zh: "赤銅礦脈", en: "Red Copper Vein" },
  vein_3: { zh: "XX 礦脈", en: "XX Vein" },
  vein_4: { zh: "XX 礦脈", en: "XX Vein" },
  vein_5: { zh: "XX 礦脈", en: "XX Vein" },
  vein_6: { zh: "XX 礦脈", en: "XX Vein" },
  vein_7: { zh: "XX 礦脈", en: "XX Vein" },
  vein_8: { zh: "XX 礦脈", en: "XX Vein" },
  vein_9: { zh: "XX 礦脈", en: "XX Vein" },
  vein_10: { zh: "XX 礦脈", en: "XX Vein" },
};

// Loot table per mine (TODO: fetch from DB)
const LOOT_TABLES: Record<string, { item_type: string; probability: number }[]> = {
  depleted_vein: [
    { item_type: "coal", probability: 0.5 },
    { item_type: "copper_ore", probability: 0.35 },
    { item_type: "spirit_stone_fragment", probability: 0.15 },
  ],
};

function rollLoot(mineSlug: string): string {
  const table = LOOT_TABLES[mineSlug] ?? LOOT_TABLES["depleted_vein"];
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.probability;
    if (roll <= cumulative) return entry.item_type;
  }
  return table[table.length - 1].item_type;
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

    globalStartMine({ id: mine.id, slug: mine.slug, xp_mining: mine.xp_mining, xp_mastery: mine.xp_mastery, xp_body: mine.xp_body });

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
        <div className="mb-5 relative rounded-2xl overflow-hidden -mx-6 md:-mx-12">
          <img src="/images/mining-title-bg.png" alt="" className="w-full h-auto block" />
          <div
            className="absolute inset-0 px-4 flex items-center justify-center gap-6"
            style={{
              textShadow: "0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/30">
                <span className="text-xl">⛏</span>
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold sm:text-2xl text-amber-200">{t("mining_title")}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-heading px-3 py-1 text-sm bg-black/30">
                {t("mining_skillLevel")} {miningLevel}
              </Badge>
              <Badge variant="outline" className="border-white/30 text-white/90 tabular-nums px-3 py-1 text-sm bg-black/30">
                {t("mining_skillXp")} {miningXp.toLocaleString()} / {miningXpMax.toLocaleString()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Skill XP bar — spirit qi vein style */}
        <div
          className="mb-6 h-2 w-full overflow-hidden rounded-full -mx-6 md:-mx-12"
          style={{
            width: "auto",
            background: "linear-gradient(90deg, rgba(0,0,0,0.4), rgba(30,30,30,0.3))",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 relative"
            style={{
              width: `${xpPercent}%`,
              background: "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
              boxShadow: "0 0 8px rgba(62,207,165,0.5), 0 0 20px rgba(62,207,165,0.2)",
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
              }}
            />
          </div>
        </div>

        {/* === Mine Grid === */}
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr -mx-6 md:-mx-12">
          {mines.map((mine) => {
            const isLocked = miningLevel < mine.required_level;
            const isActive = activeMine === mine.id && isMining;
            const mastery = masteryLevels[mine.id] ?? 0;
            const lootTable = LOOT_TABLES[mine.slug] ?? LOOT_TABLES["depleted_vein"];
            const circumference = 2 * Math.PI * 38; // SVG circle r=38

            // === LOCKED MINE CARD ===
            if (isLocked) {
              return (
                <div key={mine.id} className="relative rounded-2xl overflow-hidden">
                  <img src="/images/mining-card-bg2.png" alt="" className="w-full h-auto block" />
                  <div
                    className="absolute flex flex-col items-center justify-between rounded-xl"
                    style={{
                      top: '20%', bottom: '20%', left: '5%', right: '5%',
                      background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.40) 100%)",
                      padding: '16px',
                      textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    {/* Header — locked label */}
                    <div className="flex items-center justify-center pt-2">
                      <p className="font-heading text-base font-bold text-white/40">
                        {t("mining_locked")}
                      </p>
                    </div>

                    {/* Centered icon */}
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-7xl opacity-30">⛏</span>
                    </div>

                    {/* Disabled button at bottom */}
                    <button
                      disabled
                      className="relative w-full cursor-not-allowed opacity-70"
                    >
                      <img src="/images/mining-btn-bg3.png" alt="" className="w-full h-auto block" />
                      <span className="absolute inset-0 flex items-center justify-center font-heading font-bold text-sm text-white">
                        {t("mining_needLevel", { n: mine.required_level })}
                      </span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={mine.id} className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${
                isActive ? "ring-2 ring-jade/60" : ""
              }`}>
                  <img src="/images/mining-card-bg1.png" alt="" className="w-full h-auto block" />
                  <div
                    className="absolute flex flex-col space-y-4 rounded-xl"
                    style={{
                      top: '20%', bottom: '20%', left: '5%', right: '5%',
                      background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.40) 100%)",
                      padding: '16px',
                      textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                  {/* Mine header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <p className="font-heading text-base font-bold text-white">
                        {MINE_NAMES[mine.slug]?.[locale] ?? mine.name}
                      </p>
                      <p className="text-xs text-white/60">
                        ⏱ {(3).toFixed(2)} s
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 gap-1">
                        XP {mine.xp_mining}
                      </Badge>
                      <Badge variant="secondary" className="bg-cinnabar-dim text-cinnabar gap-1">
                        🏆 {mine.xp_mastery}
                      </Badge>
                      <Badge variant="secondary" className="bg-spirit-gold-dim text-spirit-gold gap-1">
                        💪 {mine.xp_body}
                      </Badge>
                    </div>
                  </div>

                  {/* Drop rates + Progress circle row */}
                  {(
                    <div className="flex items-center gap-4">
                      {/* Drop rates */}
                      <div className="flex-1 space-y-1.5">
                        {lootTable.map((entry) => {
                          const info = ITEM_META[entry.item_type];
                          return (
                            <div key={entry.item_type} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={info?.rarity === "rare" ? "text-spirit-gold" : info?.rarity === "uncommon" ? "text-jade" : "text-foreground"}>
                                  {info?.icon ?? "○"}
                                </span>
                                <span className="text-white/70">{getItemName(entry.item_type, locale) ?? entry.item_type}</span>
                              </div>
                              <span className="tabular-nums text-white/50 text-xs">{(entry.probability * 100).toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Circular progress */}
                      <div className="relative flex-shrink-0">
                        <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
                          {/* Track */}
                          <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeWidth="4"
                            className="text-muted/20" />
                          {/* Progress — no CSS transition; setActionProgress runs at 50ms interval which is smooth enough. Transition causes "backwards" animation on tick reset. */}
                          {isActive && (
                            <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeWidth="4"
                              strokeDasharray={`${(actionProgress / 100) * circumference} ${circumference}`}
                              strokeLinecap="round"
                              className="text-jade" />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl">⛏</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mastery with XP */}
                  {(
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70">
                          🏆 {t("mining_mastery")} <span className="font-bold text-cinnabar">{mastery}</span>
                        </span>
                        <span className="tabular-nums text-white/50">
                          {(masteryXps[mine.id] ?? 0).toLocaleString()} / {(masteryXpMaxs[mine.id] ?? 83).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                        <div className="h-full rounded-full bg-cinnabar/60 transition-all duration-300"
                          style={{ width: `${masteryXpMaxs[mine.id] ? Math.min((masteryXps[mine.id] ?? 0) / masteryXpMaxs[mine.id] * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Action button — pushed to bottom */}
                  <button
                    onClick={() => handleSelectMine(mine)}
                    className="mt-auto relative w-full hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <img
                      src={isActive ? "/images/mining-btn-bg2.png" : "/images/mining-btn-bg1.png"}
                      alt=""
                      className="w-full h-auto block"
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-heading font-bold text-sm text-white">
                      {isActive ? t("mining_stopMining") : t("mining_startMining")}
                    </span>
                  </button>

                  {isLocked && (
                    <p className="text-center text-xs text-white/40">
                      {t("mining_levelUp", { n: mine.required_level })}
                    </p>
                  )}
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
