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
import {
  type LootEntry,
  type InventoryItem,
  getMasteryDoubleDropChance,
  melvorXpForLevel,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants & Game Data
// ---------------------------------------------------------------------------

const MINE_ACTION_INTERVAL_MS = 3000;
const ROCK_RESPAWN_MS = 5000;

const DEPLETED_VEIN_LOOT: LootEntry[] = [
  { item_type: "coal", probability: 0.5, xp_mining: 5, xp_mastery: 3, xp_body: 5 },
  { item_type: "copper_ore", probability: 0.35, xp_mining: 8, xp_mastery: 5, xp_body: 8 },
  { item_type: "spirit_stone_fragment", probability: 0.15, xp_mining: 15, xp_mastery: 10, xp_body: 15 },
];

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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-heading font-bold ${glowClass}`}>
          {label} <span className="text-foreground">Lv.{level}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {currentXp.toLocaleString()} / {maxXp.toLocaleString()} XP
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
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
}: {
  hp: number;
  maxHp: number;
  isRespawning: boolean;
  respawnTimeLeft: number;
  isMining: boolean;
  actionProgress: number;
}) {
  const hpPct = maxHp > 0 ? (hp / maxHp) * 100 : 0;

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Rock visualization */}
      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-2xl border transition-all duration-300 ${
          isRespawning
            ? "border-muted bg-muted/30 opacity-50"
            : isMining
              ? "border-jade/30 bg-card"
              : "border-border bg-card"
        }`}
      >
        {/* Ink noise overlay on rock */}
        <div className="ink-noise pointer-events-none absolute inset-0 rounded-2xl" />

        {/* Rock icon - stylized mountain/mineral glyph */}
        <div className={`relative z-10 select-none font-heading text-5xl transition-transform duration-150 ${
          isMining && !isRespawning ? "animate-[rock-shake_0.15s_ease-in-out]" : ""
        }`}>
          {isRespawning ? (
            <span className="text-muted-foreground opacity-40">&#9671;</span>
          ) : (
            <span className={hpPct > 50 ? "text-ink-2" : hpPct > 25 ? "text-spirit-gold" : "text-cinnabar"}>
              &#9670;
            </span>
          )}
        </div>

        {/* Mining action ring */}
        {isMining && !isRespawning && (
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              stroke="var(--jade)"
              strokeWidth="2"
              strokeDasharray={`${(actionProgress / 100) * 364} 364`}
              strokeLinecap="round"
              className="transition-all duration-100 ease-linear"
              opacity="0.5"
            />
          </svg>
        )}
      </div>

      {/* Rock HP bar */}
      <div className="w-full max-w-[200px] space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>岩石 HP</span>
          <span className="tabular-nums">{hp} / {maxHp}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
              isRespawning ? "bg-muted-foreground/30" : "bg-cinnabar"
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        {isRespawning && (
          <p className="text-center text-xs text-muted-foreground animate-pulse">
            重生中... {(respawnTimeLeft / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}

function DropFeed({ drops }: { drops: MiningState["recentDrops"] }) {
  if (drops.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">尚無掉落物</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 overflow-hidden">
      {drops.map((drop) => {
        const info = ITEM_DISPLAY[drop.item];
        const rarityColor =
          info?.rarity === "rare"
            ? "text-spirit-gold text-glow-gold"
            : info?.rarity === "uncommon"
              ? "text-jade text-glow-jade"
              : "text-foreground";
        return (
          <div
            key={drop.timestamp + drop.item}
            className="flex items-center justify-between rounded-md bg-card/60 px-3 py-1.5 text-sm animate-[ink-fade-in_0.4s_ease-out]"
          >
            <div className="flex items-center gap-2">
              <ItemIcon itemType={drop.item} size="sm" />
              <span className={rarityColor}>{info?.name ?? drop.item}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums text-muted-foreground">x{drop.quantity}</span>
              {drop.isDouble && (
                <Badge variant="outline" className="border-spirit-gold/40 text-spirit-gold text-[10px] px-1 py-0">
                  雙倍
                </Badge>
              )}
            </div>
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
        <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">背包空空如也</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {inventory.map((item) => {
            const info = ITEM_DISPLAY[item.item_type];
            return (
              <TooltipProvider key={item.item_type} delay={200}>
                <Tooltip>
                  <TooltipTrigger className="group relative flex flex-col items-center gap-1 rounded-lg border border-border bg-card/60 p-2 transition-colors hover:border-jade/30 hover:bg-card">
                    <ItemIcon itemType={item.item_type} />
                    <span className="text-[10px] tabular-nums text-muted-foreground">
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
              className="flex h-[60px] items-center justify-center rounded-lg border border-dashed border-border/50"
            >
              <span className="text-[10px] text-muted-foreground/30">+</span>
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
// Main Page
// ---------------------------------------------------------------------------

export default function MiningPage() {
  const [state, setState] = useState<MiningState>({
    isMining: false,
    rockHp: 1,
    rockMaxHp: 1,
    isRespawning: false,
    respawnTimeLeft: 0,
    actionProgress: 0,
    miningSkillLevel: 1,
    miningSkillXp: 0,
    masteryLevel: 1,
    masteryXp: 0,
    bodyStage: 1,
    bodyXp: 0,
    inventory: [],
    inventorySlots: INITIAL_INVENTORY_SLOTS,
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

  // Simulate initial data load
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        rockMaxHp: 1 + prev.masteryLevel,
        rockHp: 1 + prev.masteryLevel,
      }));
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

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

  const performMineAction = useCallback(() => {
    setState((prev) => {
      if (prev.isRespawning) return prev;

      // Roll loot
      const lootEntry = rollLoot(DEPLETED_VEIN_LOOT);
      const doubleChance = getMasteryDoubleDropChance(prev.masteryLevel);
      const isDouble = Math.random() < doubleChance;
      const dropQuantity = isDouble ? 2 : 1;

      // Check inventory capacity
      const existingSlot = prev.inventory.find((i) => i.item_type === lootEntry.item_type);
      const slotsUsed = prev.inventory.length;
      if (!existingSlot && slotsUsed >= prev.inventorySlots) {
        // Inventory full -- item lost, but mining continues
        return { ...prev, totalActions: prev.totalActions + 1 };
      }

      // Update inventory
      const newInventory = existingSlot
        ? prev.inventory.map((i) =>
            i.item_type === lootEntry.item_type
              ? { ...i, quantity: i.quantity + dropQuantity }
              : i
          )
        : [
            ...prev.inventory,
            {
              id: crypto.randomUUID(),
              user_id: "local",
              item_type: lootEntry.item_type,
              quantity: dropQuantity,
              created_at: new Date().toISOString(),
            },
          ];

      // XP gains
      const miningXp = prev.miningSkillXp + lootEntry.xp_mining;
      const masteryXp = prev.masteryXp + lootEntry.xp_mastery;
      const bodyXp = prev.bodyXp + lootEntry.xp_body;

      // Level-up checks
      let miningLevel = prev.miningSkillLevel;
      let remainingMiningXp = miningXp;
      while (remainingMiningXp >= xpForNextLevel(miningLevel) && miningLevel < 99) {
        remainingMiningXp -= xpForNextLevel(miningLevel);
        miningLevel += 1;
      }

      let masteryLevel = prev.masteryLevel;
      let remainingMasteryXp = masteryXp;
      while (remainingMasteryXp >= xpForNextLevel(masteryLevel) && masteryLevel < 99) {
        remainingMasteryXp -= xpForNextLevel(masteryLevel);
        masteryLevel += 1;
      }

      // Rock HP
      const newRockHp = prev.rockHp - 1;
      const isNowRespawning = newRockHp <= 0;
      const newRockMaxHp = 1 + masteryLevel;

      // Drop feed (keep last 6)
      const newDrop = {
        item: lootEntry.item_type,
        quantity: dropQuantity,
        isDouble,
        timestamp: Date.now(),
      };
      const recentDrops = [newDrop, ...prev.recentDrops].slice(0, 6);

      return {
        ...prev,
        rockHp: isNowRespawning ? 0 : newRockHp,
        rockMaxHp: newRockMaxHp,
        isRespawning: isNowRespawning,
        respawnTimeLeft: isNowRespawning ? ROCK_RESPAWN_MS : 0,
        miningSkillLevel: miningLevel,
        miningSkillXp: remainingMiningXp,
        masteryLevel,
        masteryXp: remainingMasteryXp,
        bodyXp,
        inventory: newInventory,
        recentDrops,
        totalActions: prev.totalActions + 1,
      };
    });
  }, []);

  // Main mining tick (60fps for smooth progress, action every 3s)
  useEffect(() => {
    if (!state.isMining) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();
    let accumulatedAction = 0;
    let accumulatedRespawn = 0;

    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setState((prev) => {
        if (!prev.isMining) return prev;

        if (prev.isRespawning) {
          accumulatedRespawn += delta;
          accumulatedAction = 0;
          const newRespawnLeft = Math.max(0, prev.respawnTimeLeft - delta);
          if (newRespawnLeft <= 0) {
            accumulatedRespawn = 0;
            const newMaxHp = 1 + prev.masteryLevel;
            return {
              ...prev,
              isRespawning: false,
              respawnTimeLeft: 0,
              rockHp: newMaxHp,
              rockMaxHp: newMaxHp,
            };
          }
          return { ...prev, respawnTimeLeft: newRespawnLeft };
        }

        // Normal mining
        accumulatedAction += delta;
        const progress = Math.min((accumulatedAction / MINE_ACTION_INTERVAL_MS) * 100, 100);

        if (accumulatedAction >= MINE_ACTION_INTERVAL_MS) {
          accumulatedAction -= MINE_ACTION_INTERVAL_MS;
          // Action will be performed in the next cycle via performMineAction
          return { ...prev, actionProgress: 0 };
        }

        return { ...prev, actionProgress: progress };
      });

      // Check if action should fire
      if (accumulatedAction >= MINE_ACTION_INTERVAL_MS || accumulatedAction < 0) {
        // handled in setState
      }
    }, 50);

    // Action timer (every 3s)
    const actionTimer = setInterval(() => {
      performMineAction();
    }, MINE_ACTION_INTERVAL_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      clearInterval(actionTimer);
    };
  }, [state.isMining, performMineAction]);

  // XP float effects on mine action
  useEffect(() => {
    if (state.totalActions === 0) return;
    // Show xp floats based on last action
    const loot = DEPLETED_VEIN_LOOT[0]; // approximate - just show XP range
    addXpFloat("mining", loot.xp_mining);
    addXpFloat("mastery", loot.xp_mastery);
    addXpFloat("body", loot.xp_body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.totalActions]);

  const handleStartMining = useCallback(() => {
    setState((prev) => ({ ...prev, isMining: true, hasStartedOnce: true }));
    if (!firedActivateRef.current) {
      trackActivate({ action: "started_mining" });
      firedActivateRef.current = true;
    }
  }, []);

  const handleStopMining = useCallback(() => {
    setState((prev) => ({ ...prev, isMining: false, actionProgress: 0 }));
  }, []);

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
      <div className="ink-wash-bg ink-noise min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-12 sm:px-12 lg:px-16">
          <InkShimmerSkeleton className="mb-8 h-10 w-48" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
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
    <div className="ink-wash-bg ink-noise relative min-h-screen">
      {/* Page-level custom animations defined in mining-animations.css */}

      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-12 sm:py-12 lg:px-16">
        {/* Header */}
        <header className="mb-8 animate-[ink-fade-in_0.6s_ease-out]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">
              枯竭礦脈
            </h1>
            <Badge variant="outline" className="border-ink-4/30 text-muted-foreground text-xs">
              Depleted Vein
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            最基礎的礦脈，蘊含微量靈氣。初入修途者的起點。每次采掘消耗 3 秒，可獲得煤、銅礦或靈石碎片。
          </p>
        </header>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN -- Mining area + drops */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mining core */}
            <Card className="scroll-surface relative overflow-hidden animate-[ink-fade-in_0.6s_ease-out_100ms_both]">
              <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:items-start sm:gap-10">
                {/* Rock */}
                <RockDisplay
                  hp={state.rockHp}
                  maxHp={state.rockMaxHp}
                  isRespawning={state.isRespawning}
                  respawnTimeLeft={state.respawnTimeLeft}
                  isMining={state.isMining}
                  actionProgress={state.actionProgress}
                />

                {/* Controls + info */}
                <div className="flex flex-1 flex-col items-center gap-4 sm:items-start">
                  {/* Start/Stop button */}
                  {!state.isMining ? (
                    <Button
                      size="lg"
                      onClick={handleStartMining}
                      className="w-full max-w-xs bg-cinnabar text-primary-foreground hover:bg-cinnabar/90 seal-glow transition-all sm:w-auto"
                      style={state.isMining ? {} : { animation: state.hasStartedOnce ? "none" : "qi-pulse 2.5s ease-in-out infinite" }}
                    >
                      {state.hasStartedOnce ? "繼續采掘" : "開始采掘"}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleStopMining}
                      className="w-full max-w-xs sm:w-auto"
                    >
                      暫停采掘
                    </Button>
                  )}

                  {/* Mining stats row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>間隔: <span className="text-foreground tabular-nums">3.0s</span></span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>已采掘: <span className="text-foreground tabular-nums">{state.totalActions}</span></span>
                    <Separator orientation="vertical" className="h-3" />
                    <MasteryIndicator masteryLevel={state.masteryLevel} />
                  </div>

                  {/* Loot table preview */}
                  <div className="w-full rounded-lg bg-muted/30 p-3 space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">掉落表</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {DEPLETED_VEIN_LOOT.map((entry) => {
                        const info = ITEM_DISPLAY[entry.item_type];
                        return (
                          <div key={entry.item_type} className="flex items-center gap-1.5 text-xs">
                            <ItemIcon itemType={entry.item_type} size="sm" />
                            <div>
                              <span className={
                                info?.rarity === "rare"
                                  ? "text-spirit-gold"
                                  : info?.rarity === "uncommon"
                                    ? "text-jade"
                                    : "text-foreground"
                              }>
                                {info?.name}
                              </span>
                              <span className="ml-1 text-muted-foreground tabular-nums">
                                {(entry.probability * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent drops */}
            <Card className="scroll-surface animate-[ink-fade-in_0.6s_ease-out_200ms_both]">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg">最近掉落</CardTitle>
              </CardHeader>
              <CardContent>
                <DropFeed drops={state.recentDrops} />
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card className="scroll-surface animate-[ink-fade-in_0.6s_ease-out_300ms_both]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-lg">背包</CardTitle>
                  <SlotShopDialog
                    spiritStones={spiritStoneCount}
                    currentSlots={state.inventorySlots}
                    onPurchase={handlePurchaseSlot}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <InventoryPanel
                  inventory={state.inventory}
                  slots={state.inventorySlots}
                  slotsUsed={slotsUsed}
                />
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN -- Stats & XP */}
          <div className="space-y-6">
            {/* XP Bars */}
            <Card className="scroll-surface relative animate-[ink-fade-in_0.6s_ease-out_150ms_both]">
              <XpFloater gains={xpFloats} />
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg">修煉進度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Mining skill */}
                <XpBar
                  label="采掘"
                  level={state.miningSkillLevel}
                  currentXp={state.miningSkillXp}
                  maxXp={xpForNextLevel(state.miningSkillLevel)}
                  color="bg-jade"
                  glowClass="text-jade text-glow-jade"
                />

                <Separator />

                {/* Mine mastery */}
                <XpBar
                  label="礦脈精通"
                  level={state.masteryLevel}
                  currentXp={state.masteryXp}
                  maxXp={xpForNextLevel(state.masteryLevel)}
                  color="bg-cinnabar"
                  glowClass="text-cinnabar text-glow-cinnabar"
                />

                <Separator />

                {/* Body tempering */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-heading font-bold text-spirit-gold text-glow-gold">
                      練體 <span className="text-foreground">{state.bodyStage}階</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {state.bodyXp.toLocaleString()} / {xpForNextLevel(state.bodyStage).toLocaleString()} XP
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-spirit-gold transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(
                          (state.bodyXp / xpForNextLevel(state.bodyStage)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mine info */}
            <Card className="scroll-surface animate-[ink-fade-in_0.6s_ease-out_250ms_both]">
              <CardHeader className="pb-3">
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
                    <p className="font-medium tabular-nums">5.0s</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">每次采掘 XP</span>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="secondary" className="gap-1 bg-jade-dim text-jade">
                      采掘 5~15
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

            {/* Mastery bonuses */}
            <Card className="scroll-surface animate-[ink-fade-in_0.6s_ease-out_350ms_both]">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg">精通獎勵</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 99].map((tier) => {
                    const chance = getMasteryDoubleDropChance(tier);
                    const unlocked = state.masteryLevel >= tier;
                    return (
                      <div
                        key={tier}
                        className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors ${
                          unlocked
                            ? "bg-spirit-gold-dim text-spirit-gold"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="tabular-nums">Lv.{tier}</span>
                        <span className="tabular-nums">
                          雙倍 {(chance * 100).toFixed(0)}%
                        </span>
                        {unlocked && (
                          <span className="text-spirit-gold font-bold">&#10003;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
