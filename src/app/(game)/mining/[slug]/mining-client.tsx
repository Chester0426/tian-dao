"use client";

import "./mining-animations.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trackActivate } from "@/lib/events";
import { useMining } from "@/components/mining-provider";
import {
  type LootEntry,
  type Mine,
  type InventoryItem,
  getMasteryDoubleDropChance,
  melvorXpForLevel,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants & Game Data (passed via props from server component)
// ---------------------------------------------------------------------------

import type { Profile } from "@/lib/types";

const ITEM_DISPLAY: Record<string, { name: string; icon: string; rarity: "common" | "uncommon" | "rare" }> = {
  coal: { name: "煤", icon: "ite", rarity: "common" },
  copper_ore: { name: "銅礦", icon: "cu", rarity: "uncommon" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "ss", rarity: "rare" },
};

const INITIAL_INVENTORY_SLOTS = 20;
const BASE_SLOT_PRICE = 5; // spirit stone fragments

// ---------------------------------------------------------------------------
// Helper: roll loot table
// ---------------------------------------------------------------------------

function rollLoot(table: LootEntry[]): LootEntry {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.probability;
    if (roll <= cumulative) return entry;
  }
  return table[table.length - 1];
}

// ---------------------------------------------------------------------------
// Helper: XP to next level (Melvor curve)
// ---------------------------------------------------------------------------

function xpForNextLevel(currentLevel: number): number {
  return melvorXpForLevel(currentLevel + 1) - melvorXpForLevel(currentLevel);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MiningState {
  isMining: boolean;
  rockHp: number;
  rockMaxHp: number;
  isRespawning: boolean;
  respawnTimeLeft: number;
  actionProgress: number; // 0..100 during 3s cycle
  miningSkillLevel: number;
  miningSkillXp: number;
  masteryLevel: number;
  masteryXp: number;
  bodyStage: number;
  bodyXp: number;
  inventory: InventoryItem[];
  inventorySlots: number;
  recentDrops: { item: string; quantity: number; isDouble: boolean; timestamp: number }[];
  totalActions: number;
  hasStartedOnce: boolean;
}

interface XpGainFloat {
  id: number;
  type: "mining" | "mastery" | "body";
  amount: number;
  timestamp: number;
}

interface DropNotification {
  id: number;
  item: string;
  quantity: number;
  isDouble: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InkShimmerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-muted ${className}`}>
      <div className="absolute inset-0 animate-[ink-shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-ink-4/20 to-transparent" />
    </div>
  );
}

function XpBar({
  label,
  level,
  currentXp,
  maxXp,
  color,
  glowClass,
}: {
  label: string;
  level: number;
  currentXp: number;
  maxXp: number;
  color: string;
  glowClass: string;
}) {
  const pct = maxXp > 0 ? Math.min((currentXp / maxXp) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-heading font-bold ${glowClass}`}>
          {label} <span className="text-foreground">Lv.{level}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {currentXp.toLocaleString()} / {maxXp.toLocaleString()} XP
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted/60">
        {/* Background texture */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ink-4/5 to-transparent" />
        {/* Progress fill with gradient */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${color}`}
          style={{
            width: `${pct}%`,
            backgroundImage: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
          }}
        />
        {/* Shine effect at the leading edge */}
        {pct > 5 && (
          <div
            className="absolute inset-y-0 w-1 rounded-full bg-white/20 transition-all duration-500"
            style={{ left: `${Math.max(0, pct - 1)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function RockDisplay({
  hp,
  maxHp,
  isRespawning,
  respawnTimeLeft,
  isMining,
  actionProgress,
  actionIntervalMs,
}: {
  hp: number;
  maxHp: number;
  isRespawning: boolean;
  respawnTimeLeft: number;
  isMining: boolean;
  actionProgress: number;
  actionIntervalMs: number;
}) {
  const hpPct = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  const isLowHp = hpPct <= 25 && hpPct > 0;

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Rock visualization - larger with atmospheric depth */}
      <div
        className={`relative flex h-36 w-36 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${
          isRespawning
            ? "border-muted/40 bg-muted/20 opacity-40"
            : isMining
              ? "border-jade/30 bg-gradient-to-b from-card to-card/80"
              : "border-border/60 bg-gradient-to-b from-card to-card/80"
        }`}
        style={isMining && !isRespawning ? { animation: `mining-pulse ${actionIntervalMs}ms ease-in-out infinite` } : undefined}
      >
        {/* Ink noise overlay on rock */}
        <div className="ink-noise pointer-events-none absolute inset-0 rounded-2xl" />

        {/* Background radial glow when mining */}
        {isMining && !isRespawning && (
          <div className="absolute inset-0 rounded-2xl bg-radial-[at_50%_50%] from-jade-dim/40 to-transparent" />
        )}

        {/* Ambient particles when mining */}
        {isMining && !isRespawning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute bottom-2 rounded-full bg-jade/50"
                style={{
                  left: `${20 + i * 15}%`,
                  width: `${2 + (i % 2)}px`,
                  height: `${2 + (i % 2)}px`,
                  animation: `ambient-float ${2 + i * 0.5}s ease-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Rock SVG — stylized mineral crystal */}
        <div className={`relative z-10 select-none transition-transform duration-150 ${
          isMining && !isRespawning ? "animate-[rock-shake_0.15s_ease-in-out]" : ""
        }`}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
            className={isLowHp ? "animate-[rock-crack-pulse_1.5s_ease-in-out_infinite]" : ""}
            style={{ filter: isRespawning ? "grayscale(1) opacity(0.3)" : undefined }}
          >
            {/* Main crystal shape */}
            <path d="M32 4L52 22L46 56H18L12 22L32 4Z" fill="currentColor"
              className={hpPct > 50 ? "text-ink-3" : hpPct > 25 ? "text-spirit-gold/70" : "text-cinnabar/70"}
            />
            {/* Highlight facet */}
            <path d="M32 4L42 20L32 42L22 20L32 4Z" fill="currentColor"
              className={hpPct > 50 ? "text-ink-2" : hpPct > 25 ? "text-spirit-gold/50" : "text-cinnabar/50"}
            />
            {/* Shadow facet */}
            <path d="M42 20L52 22L46 56H30L32 42L42 20Z" fill="currentColor"
              className="text-ink-4/40"
            />
            {/* Crack lines when low HP */}
            {isLowHp && (
              <>
                <line x1="28" y1="18" x2="22" y2="38" stroke="var(--cinnabar)" strokeWidth="1" opacity="0.7" />
                <line x1="36" y1="24" x2="42" y2="44" stroke="var(--cinnabar)" strokeWidth="0.8" opacity="0.5" />
              </>
            )}
            {/* Spirit stone sparkle hints */}
            <circle cx="28" cy="30" r="1.5" fill="var(--spirit-gold)" opacity="0.6" />
            <circle cx="38" cy="36" r="1" fill="var(--jade)" opacity="0.5" />
          </svg>
        </div>

        {/* Mining action ring */}
        {isMining && !isRespawning && (
          <svg className="absolute inset-0 h-full w-full -rotate-90" style={{ animation: `ring-glow ${actionIntervalMs}ms ease-in-out infinite` }} viewBox="0 0 144 144">
            {/* Track ring */}
            <circle cx="72" cy="72" r="65" fill="none" stroke="var(--jade)" strokeWidth="1.5" opacity="0.1" />
            {/* Progress ring */}
            <circle
              cx="72"
              cy="72"
              r="65"
              fill="none"
              stroke="var(--jade)"
              strokeWidth="2.5"
              strokeDasharray={`${(actionProgress / 100) * 408} 408`}
              strokeLinecap="round"
              className="transition-all duration-100 ease-linear"
              opacity="0.7"
            />
          </svg>
        )}
      </div>

      {/* Rock HP bar */}
      <div className="w-full max-w-[220px] space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-heading font-medium">岩石 HP</span>
          <span className="tabular-nums font-medium">{hp} / {maxHp}</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/60">
          {/* Background shimmer track */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ink-4/10 to-transparent" />
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
              isRespawning
                ? "bg-muted-foreground/30"
                : isLowHp
                  ? "bg-gradient-to-r from-cinnabar to-cinnabar/70"
                  : "bg-gradient-to-r from-cinnabar to-cinnabar/80"
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        {isRespawning && (
          <p className="text-center text-xs text-muted-foreground">
            <span className="animate-pulse">搜尋中...</span> <span className="tabular-nums">{(respawnTimeLeft / 1000).toFixed(1)}s</span>
          </p>
        )}
      </div>
    </div>
  );
}

function FloatingNotifications({ drops, xpGains }: { drops: DropNotification[]; xpGains: XpGainFloat[] }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-1.5 pointer-events-none">
      {/* XP gains — smaller pills above drops */}
      {xpGains.map((g) => {
        const color = g.type === "mining" ? "text-jade" : g.type === "mastery" ? "text-cinnabar" : "text-spirit-gold";
        const bg = g.type === "mining" ? "bg-jade-dim/60 border-jade/20" : g.type === "mastery" ? "bg-cinnabar-dim/60 border-cinnabar/20" : "bg-spirit-gold-dim/60 border-spirit-gold/20";
        const label = g.type === "mining" ? "挖礦" : g.type === "mastery" ? "精通" : "練體";
        return (
          <div
            key={g.id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-heading font-bold backdrop-blur-sm ${bg} ${color}`}
            style={{ animation: "drop-float-up 2s ease-out forwards" }}
          >
            +{g.amount} {label}
          </div>
        );
      })}
      {/* Item drops — larger pills */}
      {drops.map((drop) => {
        const info = ITEM_DISPLAY[drop.item];
        const rarityColor =
          info?.rarity === "rare"
            ? "text-spirit-gold"
            : info?.rarity === "uncommon"
              ? "text-jade"
              : "text-foreground";
        const bgColor =
          info?.rarity === "rare"
            ? "bg-spirit-gold-dim/80 border-spirit-gold/30"
            : info?.rarity === "uncommon"
              ? "bg-jade-dim/80 border-jade/30"
              : "bg-card/90 border-border/40";
        return (
          <div
            key={drop.id}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm shadow-lg ${bgColor}`}
            style={{ animation: "drop-float-up 2.5s ease-out forwards" }}
          >
            <ItemIcon itemType={drop.item} size="sm" />
            <span className={rarityColor}>{info?.name ?? drop.item}</span>
            <span className={`tabular-nums ${drop.isDouble ? "text-spirit-gold font-bold" : "text-muted-foreground"}`}>
              x{drop.quantity}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ItemIcon({ itemType, size = "md" }: { itemType: string; size?: "sm" | "md" }) {
  const info = ITEM_DISPLAY[itemType];
  const sizeClass = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  const bgColor =
    info?.rarity === "rare"
      ? "bg-spirit-gold-dim border-spirit-gold/20"
      : info?.rarity === "uncommon"
        ? "bg-jade-dim border-jade/20"
        : "bg-muted border-border";

  return (
    <div
      className={`flex items-center justify-center rounded-md border font-heading font-bold uppercase ${sizeClass} ${bgColor}`}
    >
      {info?.icon ?? "?"}
    </div>
  );
}

function InventoryPanel({
  inventory,
  slots,
  slotsUsed,
}: {
  inventory: InventoryItem[];
  slots: number;
  slotsUsed: number;
}) {
  const isFull = slotsUsed >= slots;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          欄位 <span className="tabular-nums font-medium text-foreground">{slotsUsed}/{slots}</span>
        </span>
        {isFull && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            背包已滿
          </Badge>
        )}
      </div>

      {inventory.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-muted-foreground/30">
            <rect x="4" y="8" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 14h20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <path d="M10 8V6a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <p className="text-sm text-muted-foreground/60">背包空空如也</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {inventory.map((item) => {
            const info = ITEM_DISPLAY[item.item_type];
            const slotBorder =
              info?.rarity === "rare"
                ? "border-spirit-gold/20 hover:border-spirit-gold/40"
                : info?.rarity === "uncommon"
                  ? "border-jade/20 hover:border-jade/40"
                  : "border-border hover:border-jade/20";
            return (
              <TooltipProvider key={item.item_type} delay={200}>
                <Tooltip>
                  <TooltipTrigger className={`group relative flex flex-col items-center gap-1.5 rounded-lg border bg-card/60 p-2.5 transition-all duration-200 hover:bg-card hover:scale-[1.04] hover:shadow-lg ${slotBorder}`}>
                    <ItemIcon itemType={item.item_type} />
                    <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
                      {item.quantity.toLocaleString()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-heading">{info?.name ?? item.item_type}</p>
                    <p className="text-xs text-muted-foreground">x{item.quantity.toLocaleString()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {/* Empty slot indicators */}
          {Array.from({ length: Math.min(slots - slotsUsed, 8) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-[68px] items-center justify-center rounded-lg border border-dashed border-border/30 bg-muted/10 transition-colors hover:border-border/60"
            >
              <span className="text-xs text-muted-foreground/20">+</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotShopDialog({
  spiritStones,
  currentSlots,
  onPurchase,
}: {
  spiritStones: number;
  currentSlots: number;
  onPurchase: () => void;
}) {
  const extraSlots = currentSlots - INITIAL_INVENTORY_SLOTS;
  const price = BASE_SLOT_PRICE + extraSlots * 3; // escalating price
  const canAfford = spiritStones >= price;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 border-spirit-gold/30 text-spirit-gold hover:bg-spirit-gold-dim hover:text-spirit-gold" />
        }
      >
        <span className="text-base">+</span> 擴充背包
      </DialogTrigger>
      <DialogContent className="scroll-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">背包擴充</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">目前欄位</span>
              <span className="font-medium tabular-nums">{currentSlots}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">費用</span>
              <div className="flex items-center gap-1.5">
                <ItemIcon itemType="spirit_stone_fragment" size="sm" />
                <span className="font-heading font-bold text-spirit-gold tabular-nums">{price}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">持有靈石碎片</span>
              <span className="tabular-nums">{spiritStones}</span>
            </div>
          </div>

          <Button
            onClick={onPurchase}
            disabled={!canAfford}
            className="w-full bg-spirit-gold text-background hover:bg-spirit-gold/90 disabled:opacity-40"
          >
            {canAfford ? `購買 +1 欄位 (${price} 靈石碎片)` : "靈石碎片不足"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function XpFloater({ gains }: { gains: XpGainFloat[] }) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-20 space-y-1">
      {gains.map((g) => {
        const color =
          g.type === "mining"
            ? "text-jade"
            : g.type === "mastery"
              ? "text-cinnabar"
              : "text-spirit-gold";
        const label = g.type === "mining" ? "采" : g.type === "mastery" ? "悟" : "體";
        return (
          <div
            key={g.id}
            className={`animate-[xp-float_1.2s_ease-out_forwards] text-xs font-heading font-bold ${color}`}
          >
            +{g.amount} {label}
          </div>
        );
      })}
    </div>
  );
}

function MasteryIndicator({ masteryLevel }: { masteryLevel: number }) {
  const chance = getMasteryDoubleDropChance(masteryLevel);
  if (chance === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md bg-spirit-gold-dim px-3 py-1.5">
      <span className="text-xs text-spirit-gold font-heading font-bold">雙倍掉落</span>
      <span className="text-xs tabular-nums text-spirit-gold/80">{(chance * 100).toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface OfflineRewardsData {
  minutes_away: number;
  total_actions: number;
  drops: { item_type: string; quantity: number }[];
  xp_gained: { mining: number; mastery: number; body: number };
}

interface MiningClientProps {
  mineId: string;
  mineData: Mine;
  initialProfile: Profile;
  initialMiningLevel: number;
  initialMasteryLevel: number;
  initialInventory: InventoryItem[];
  isDemo: boolean;
  autoStart?: boolean;
  offlineRewards?: OfflineRewardsData | null;
}

export function MiningClient({
  mineId,
  mineData,
  initialProfile,
  initialMiningLevel,
  initialMasteryLevel,
  initialInventory,
  isDemo,
  autoStart = false,
  offlineRewards = null,
}: MiningClientProps) {
  const [state, setState] = useState<MiningState>({
    isMining: false,
    rockHp: 1 + initialMasteryLevel,
    rockMaxHp: 1 + initialMasteryLevel,
    isRespawning: false,
    respawnTimeLeft: 0,
    actionProgress: 0,
    miningSkillLevel: initialMiningLevel,
    miningSkillXp: 0,
    masteryLevel: initialMasteryLevel,
    masteryXp: 0,
    bodyStage: initialProfile.cultivation_stage,
    bodyXp: initialProfile.body_xp,
    inventory: initialInventory,
    inventorySlots: initialProfile.inventory_slots,
    recentDrops: [],
    totalActions: 0,
    hasStartedOnce: false,
  });

  const [xpFloats, setXpFloats] = useState<XpGainFloat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const floatIdRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const firedActivateRef = useRef(false);
  const accumulatedRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state; // keep ref in sync with latest state

  const [dropNotifications, setDropNotifications] = useState<DropNotification[]>([]);
  const dropIdRef = useRef(0);

  // Clean up old drop notifications
  useEffect(() => {
    if (dropNotifications.length === 0) return;
    const timer = setTimeout(() => {
      setDropNotifications((prev) => prev.filter((d) => Date.now() - d.timestamp < 2500));
    }, 2600);
    return () => clearTimeout(timer);
  }, [dropNotifications]);

  // Offline rewards handled globally by GlobalGameUI

  // Data loaded from server — mark as ready, auto-start if returning
  useEffect(() => {
    setIsLoading(false);
    if (autoStart) {
      setState((prev) => ({ ...prev, isMining: true, hasStartedOnce: true }));
      if (!firedActivateRef.current) {
        trackActivate({ action: "auto_resumed_mining" });
        firedActivateRef.current = true;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // XP float cleanup
  useEffect(() => {
    if (xpFloats.length === 0) return;
    const timer = setTimeout(() => {
      setXpFloats((prev) => prev.filter((f) => Date.now() - f.timestamp < 1200));
    }, 1300);
    return () => clearTimeout(timer);
  }, [xpFloats]);

  const addXpFloat = useCallback((type: XpGainFloat["type"], amount: number) => {
    floatIdRef.current += 1;
    setXpFloats((prev) => [
      ...prev.slice(-5),
      { id: floatIdRef.current, type, amount, timestamp: Date.now() },
    ]);
  }, []);

  const performMineAction = useCallback(async () => {
    if (isDemo) {
      // Demo mode: client-side calculation (no API)
      setState((prev) => {
        if (prev.isRespawning) return prev;
        const lootEntry = rollLoot(mineData.loot_table);
        const doubleChance = getMasteryDoubleDropChance(prev.masteryLevel);
        const isDouble = Math.random() < doubleChance;
        const dropQuantity = isDouble ? 2 : 1;
        const existingItem = prev.inventory.find((i) => i.item_type === lootEntry.item_type);
        if (!existingItem && prev.inventory.length >= prev.inventorySlots) {
          return { ...prev, totalActions: prev.totalActions + 1 };
        }
        const newInventory = existingItem
          ? prev.inventory.map((i) => i.item_type === lootEntry.item_type ? { ...i, quantity: i.quantity + dropQuantity } : i)
          : [...prev.inventory, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: lootEntry.item_type, quantity: dropQuantity, created_at: new Date().toISOString() }];
        const newRockHp = prev.rockHp - 1;
        const isNowRespawning = newRockHp <= 0;
        return {
          ...prev, rockHp: isNowRespawning ? 0 : newRockHp, rockMaxHp: 1 + prev.masteryLevel,
          isRespawning: isNowRespawning, respawnTimeLeft: isNowRespawning ? mineData.respawn_seconds * 1000 : 0,
          miningSkillXp: prev.miningSkillXp + lootEntry.xp_mining, masteryXp: prev.masteryXp + lootEntry.xp_mastery,
          bodyXp: prev.bodyXp + lootEntry.xp_body, inventory: newInventory,
          recentDrops: [{ item: lootEntry.item_type, quantity: dropQuantity, isDouble, timestamp: Date.now() }, ...prev.recentDrops].slice(0, 6),
          totalActions: prev.totalActions + 1,
        };
      });
      return;
    }

    // Server-authoritative: call API
    try {
      const res = await fetch("/api/game/mine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mine_id: mineId }),
      });

      if (res.status === 429) {
        // Cooldown — server says too fast, just wait
        return;
      }

      if (res.status === 409) {
        // Inventory full
        setState((prev) => ({ ...prev, totalActions: prev.totalActions + 1 }));
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      const { drop, xp, levels, totals } = data;

      setState((prev) => {
        // Update inventory from server truth
        const existingItem = prev.inventory.find((i) => i.item_type === drop.item_type);
        const newInventory = existingItem
          ? prev.inventory.map((i) => i.item_type === drop.item_type ? { ...i, quantity: drop.total_quantity } : i)
          : [...prev.inventory, { id: crypto.randomUUID(), user_id: "server", slot: 1, item_type: drop.item_type, quantity: drop.total_quantity, created_at: new Date().toISOString() }];

        // Rock HP (client-side tracking for animation)
        const newRockHp = prev.rockHp - 1;
        const isNowRespawning = newRockHp <= 0;
        const newRockMaxHp = 1 + levels.mastery;

        return {
          ...prev,
          rockHp: isNowRespawning ? 0 : newRockHp,
          rockMaxHp: newRockMaxHp,
          isRespawning: isNowRespawning,
          respawnTimeLeft: isNowRespawning ? mineData.respawn_seconds * 1000 : 0,
          miningSkillLevel: levels.mining,
          miningSkillXp: totals.mining_xp,
          masteryLevel: levels.mastery,
          masteryXp: totals.mastery_xp,
          bodyStage: levels.cultivation_stage,
          bodyXp: totals.body_xp,
          inventory: newInventory,
          recentDrops: prev.recentDrops, // no longer updated here
          totalActions: prev.totalActions + 1,
        };
      });

      // Show floating drop notification
      dropIdRef.current += 1;
      setDropNotifications((prev) => [
        ...prev.slice(-4),
        { id: dropIdRef.current, item: drop.item_type, quantity: drop.quantity, isDouble: drop.is_double, timestamp: Date.now() },
      ]);

      // Show XP floats
      addXpFloat("mining", xp.mining);
      addXpFloat("mastery", xp.mastery);
      addXpFloat("body", xp.body);
    } catch {
      // Network error — silently skip this tick, retry next
    }
  }, [mineId, mineData, isDemo, addXpFloat]);

  // Main mining tick — all timing via refs, setState only for rendering
  useEffect(() => {
    if (!state.isMining) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();
    accumulatedRef.current = 0;
    const inFlightRef = { current: false };

    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const cur = stateRef.current;
      if (!cur.isMining) return;

      if (cur.isRespawning) {
        accumulatedRef.current = 0;
        setState((prev) => {
          const newRespawnLeft = Math.max(0, prev.respawnTimeLeft - delta);
          if (newRespawnLeft <= 0) {
            const newMaxHp = 1 + prev.masteryLevel;
            return { ...prev, isRespawning: false, respawnTimeLeft: 0, rockHp: newMaxHp, rockMaxHp: newMaxHp };
          }
          return { ...prev, respawnTimeLeft: newRespawnLeft };
        });
        return;
      }

      // Timer always runs at precise 3s — never paused by API
      accumulatedRef.current += delta;

      if (accumulatedRef.current >= mineData.action_interval_ms) {
        accumulatedRef.current -= mineData.action_interval_ms;
        setState((prev) => ({ ...prev, actionProgress: 0 }));

        // Fire API in background, skip if previous call still in flight
        if (!inFlightRef.current) {
          inFlightRef.current = true;
          performMineAction().finally(() => {
            inFlightRef.current = false;
          });
        }
      } else {
        const progress = (accumulatedRef.current / mineData.action_interval_ms) * 100;
        setState((prev) => ({ ...prev, actionProgress: progress }));
      }
    }, 50);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.isMining, performMineAction]);

  // XP floats now triggered inside performMineAction (server response or demo mode)

  const { startMining: globalStartMining, stopMining: globalStopMining, pauseBackground, resumeBackground } = useMining();

  // Pause background mining when on mining page (this page handles its own API calls)
  useEffect(() => {
    pauseBackground();
    return () => resumeBackground();
  }, [pauseBackground, resumeBackground]);

  const handleStartMining = useCallback(() => {
    setState((prev) => ({ ...prev, isMining: true, hasStartedOnce: true }));
    globalStartMining(mineId); // Start background mining in layout
    if (!firedActivateRef.current) {
      trackActivate({ action: "started_mining" });
      firedActivateRef.current = true;
    }
  }, [mineId, globalStartMining]);

  const handleStopMining = useCallback(() => {
    setState((prev) => ({ ...prev, isMining: false, actionProgress: 0 }));
    globalStopMining(); // Stop background mining
  }, [globalStopMining]);

  const handlePurchaseSlot = useCallback(() => {
    setState((prev) => {
      const spiritStones = prev.inventory.find(
        (i) => i.item_type === "spirit_stone_fragment"
      );
      const extraSlots = prev.inventorySlots - INITIAL_INVENTORY_SLOTS;
      const price = BASE_SLOT_PRICE + extraSlots * 3;

      if (!spiritStones || spiritStones.quantity < price) return prev;

      return {
        ...prev,
        inventorySlots: prev.inventorySlots + 1,
        inventory: prev.inventory.map((i) =>
          i.item_type === "spirit_stone_fragment"
            ? { ...i, quantity: i.quantity - price }
            : i
        ),
      };
    });
  }, []);

  const spiritStoneCount =
    state.inventory.find((i) => i.item_type === "spirit_stone_fragment")?.quantity ?? 0;
  const slotsUsed = state.inventory.length;


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <InkShimmerSkeleton className="mb-8 h-10 w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <InkShimmerSkeleton className="h-64" />
              <InkShimmerSkeleton className="h-32" />
            </div>
            <div className="space-y-6">
              <InkShimmerSkeleton className="h-48" />
              <InkShimmerSkeleton className="h-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Page-level custom animations defined in mining-animations.css */}

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header — with decorative brush stroke */}
        <header className="relative mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <h1 className="font-heading text-2xl font-bold sm:text-3xl tracking-tight">
                枯竭礦脈
              </h1>
              {/* Brush stroke underline accent */}
              <div
                className="absolute -bottom-1.5 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-cinnabar via-cinnabar/60 to-transparent"
                style={{ animation: "header-brush-in 0.8s ease-out 0.3s both" }}
              />
            </div>
            <Badge variant="outline" className="border-ink-4/30 text-muted-foreground text-xs font-heading tracking-wide">
              Depleted Vein
            </Badge>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            最基礎的礦脈，蘊含微量靈氣。初入修途者的起點。每次挖礦消耗 <span className="text-foreground tabular-nums font-medium">{(mineData.action_interval_ms / 1000).toFixed(1)}</span> 秒，可獲得煤、銅礦或靈石碎片。
          </p>
          {/* Decorative corner mark (seal-like) */}
          <div className="absolute -right-2 -top-2 hidden h-10 w-10 items-center justify-center rounded-sm border border-cinnabar/20 text-cinnabar/30 font-heading text-xs sm:flex"
            style={{ animation: "seal-stamp 0.6s ease-out 0.5s both" }}
          >
            采
          </div>
        </header>

        {/* Main grid — same 2-col pattern as dashboard */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* === Mining Action Card === */}
          <Card className="scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-lg">挖礦</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    間隔 <span className="text-foreground tabular-nums">{(mineData.action_interval_ms / 1000).toFixed(1)}s</span> · 已挖礦 <span className="text-foreground tabular-nums">{state.totalActions}</span>
                  </p>
                </div>
                <MasteryIndicator masteryLevel={state.masteryLevel} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rock display */}
              <RockDisplay
                hp={state.rockHp}
                maxHp={state.rockMaxHp}
                isRespawning={state.isRespawning}
                respawnTimeLeft={state.respawnTimeLeft}
                isMining={state.isMining}
                actionProgress={state.actionProgress}
                actionIntervalMs={mineData.action_interval_ms}
              />

              {/* Start/Stop button */}
              {!state.isMining ? (
                <Button
                  size="lg"
                  onClick={handleStartMining}
                  className="w-full bg-cinnabar text-primary-foreground hover:bg-cinnabar/90 seal-glow transition-all font-heading"
                  style={state.isMining ? {} : { animation: state.hasStartedOnce ? "none" : "qi-pulse 2.5s ease-in-out infinite" }}
                >
                  {state.hasStartedOnce ? "繼續挖礦" : "開始挖礦"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleStopMining}
                  className="w-full"
                >
                  暫停挖礦
                </Button>
              )}

              {/* Loot table — vertical list */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">掉落表</h3>
                <div className="space-y-1.5">
                  {mineData.loot_table.map((entry) => {
                    const info = ITEM_DISPLAY[entry.item_type];
                    return (
                      <div key={entry.item_type} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <ItemIcon itemType={entry.item_type} size="sm" />
                          <span className={
                            info?.rarity === "rare"
                              ? "text-spirit-gold"
                              : info?.rarity === "uncommon"
                                ? "text-jade"
                                : "text-foreground"
                          }>
                            {info?.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {(entry.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* === XP Progression Card === */}
          <Card className="scroll-surface relative transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="font-heading text-lg">修煉進度</CardTitle>
              <p className="text-sm text-muted-foreground">挖礦、精通與練體經驗</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <XpBar
                label="挖礦"
                level={state.miningSkillLevel}
                currentXp={state.miningSkillXp}
                maxXp={xpForNextLevel(state.miningSkillLevel)}
                color="bg-jade"
                glowClass="text-jade text-glow-jade"
              />

              <Separator />

              <XpBar
                label="礦脈精通"
                level={state.masteryLevel}
                currentXp={state.masteryXp}
                maxXp={xpForNextLevel(state.masteryLevel)}
                color="bg-cinnabar"
                glowClass="text-cinnabar text-glow-cinnabar"
              />

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-heading font-bold text-spirit-gold text-glow-gold">
                    練體 <span className="text-foreground">{state.bodyStage}階</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {state.bodyXp.toLocaleString()} / {xpForNextLevel(state.bodyStage).toLocaleString()} XP
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted/60">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ink-4/5 to-transparent" />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-spirit-gold transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(
                        (state.bodyXp / xpForNextLevel(state.bodyStage)) * 100,
                        100
                      )}%`,
                      backgroundImage: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Spacer for removed drop feed card */}
          <div />

          {/* === Mine Info Card === */}
          <Card className="scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="font-heading text-lg">礦場資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">名稱</span>
                  <p className="font-heading font-bold">枯竭礦脈</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">等級需求</span>
                  <p className="font-medium tabular-nums">Lv.1</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">岩石 HP</span>
                  <p className="font-medium tabular-nums">{state.rockMaxHp}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">重生時間</span>
                  <p className="font-medium tabular-nums">{mineData.respawn_seconds}.0s</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">每次挖礦 XP</span>
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1 bg-jade-dim text-jade">
                    挖礦 5~15
                  </Badge>
                  <Badge variant="secondary" className="gap-1 bg-cinnabar-dim text-cinnabar">
                    精通 3~10
                  </Badge>
                  <Badge variant="secondary" className="gap-1 bg-spirit-gold-dim text-spirit-gold">
                    練體 5~15
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* === Mastery Bonuses — full width === */}
          <Card className="md:col-span-2 scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="font-heading text-lg">精通獎勵</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 99].map((tier, idx) => {
                  const chance = getMasteryDoubleDropChance(tier);
                  const unlocked = state.masteryLevel >= tier;
                  const nextUnlock = !unlocked && (idx === 0 || state.masteryLevel >= [10, 20, 30, 40, 50, 60, 70, 80, 90, 99][idx - 1]);
                  return (
                    <div
                      key={tier}
                      className={`group relative flex items-center justify-between overflow-hidden rounded-lg px-3 py-2 text-xs transition-all duration-300 ${
                        unlocked
                          ? "bg-spirit-gold-dim/40 text-spirit-gold border border-spirit-gold/15"
                          : nextUnlock
                            ? "bg-muted/40 text-muted-foreground border border-jade/10"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {nextUnlock && (
                        <div
                          className="absolute inset-y-0 left-0 bg-jade-dim/20 transition-all duration-500"
                          style={{ width: `${Math.min((state.masteryLevel / tier) * 100, 100)}%` }}
                        />
                      )}
                      <span className="relative z-10 tabular-nums font-heading font-bold">Lv.{tier}</span>
                      <span className="relative z-10 tabular-nums">
                        雙倍 {(chance * 100).toFixed(0)}%
                      </span>
                      {unlocked && (
                        <span className="relative z-10 text-spirit-gold font-bold text-glow-gold">&#10003;</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating notifications — drops + XP */}
      <FloatingNotifications drops={dropNotifications} xpGains={xpFloats} />

      {/* Offline rewards handled globally by GlobalGameUI */}
    </div>
  );
}
