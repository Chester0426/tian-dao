"use client";

import "./[slug]/mining-animations.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trackActivate } from "@/lib/events";
import { useMining } from "@/components/mining-provider";
import type { InventoryItem } from "@/lib/types";
import type { MineInfo } from "./page";

// ---------------------------------------------------------------------------
// Item display
// ---------------------------------------------------------------------------

const ITEM_DISPLAY: Record<string, { name: string; icon: string; rarity: "common" | "uncommon" | "rare" }> = {
  coal: { name: "煤", icon: "◆", rarity: "common" },
  copper_ore: { name: "銅礦", icon: "◇", rarity: "uncommon" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "✦", rarity: "rare" },
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
  inventory: initialInventory,
  inventorySlots,
  activeMineId,
  isDemo,
}: MiningPageClientProps) {
  const { startMining: globalStart, stopMining: globalStop, pauseBackground, resumeBackground } = useMining();

  // State
  const [activeMine, setActiveMine] = useState<string | null>(activeMineId);
  const [isMining, setIsMining] = useState(!!activeMineId);
  const [miningLevel, setMiningLevel] = useState(initialLevel);
  const [miningXp, setMiningXp] = useState(initialXp);
  const [miningXpMax, setMiningXpMax] = useState(initialXpMax);
  const [masteryLevels, setMasteryLevels] = useState(initialMasteryLevels);
  const [inventory, setInventory] = useState(initialInventory);
  const [actionProgress, setActionProgress] = useState(0);
  const [notifications, setNotifications] = useState<DropNotification[]>([]);

  const notifIdRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());
  const accumulatedRef = useRef(0);
  const inFlightRef = useRef(false);
  const firedActivateRef = useRef(false);
  const isMiningRef = useRef(isMining);
  const activeMineRef = useRef(activeMine);

  isMiningRef.current = isMining;
  activeMineRef.current = activeMine;

  // Pause background mining provider (this page handles its own)
  useEffect(() => {
    pauseBackground();
    return () => resumeBackground();
  }, [pauseBackground, resumeBackground]);

  // Clean old notifications
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => Date.now() - n.timestamp < 2500));
    }, 2600);
    return () => clearTimeout(timer);
  }, [notifications]);

  // Pending sync data (accumulated since last sync)
  const pendingRef = useRef({ actions: 0, elapsed_ms: 0, drops: {} as Record<string, number>, xp: { mining: 0, mastery: 0, body: 0 } });
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncRef = useRef(Date.now());

  // Sync to server every 30 seconds
  const syncToServer = useCallback(async () => {
    const mineId = activeMineRef.current;
    const pending = pendingRef.current;
    if (!mineId || pending.actions === 0 || isDemo) return;

    // Snapshot and reset pending
    const toSync = { ...pending, drops: { ...pending.drops }, xp: { ...pending.xp } };
    pendingRef.current = { actions: 0, elapsed_ms: 0, drops: {}, xp: { mining: 0, mastery: 0, body: 0 } };

    try {
      await fetch("/api/game/sync-mining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mine_id: mineId, ...toSync }),
      });
    } catch {
      // Network error — add back to pending for next sync
      pendingRef.current.actions += toSync.actions;
      pendingRef.current.elapsed_ms += toSync.elapsed_ms;
      for (const [k, v] of Object.entries(toSync.drops)) {
        pendingRef.current.drops[k] = (pendingRef.current.drops[k] ?? 0) + v;
      }
      pendingRef.current.xp.mining += toSync.xp.mining;
      pendingRef.current.xp.mastery += toSync.xp.mastery;
      pendingRef.current.xp.body += toSync.xp.body;
    }
  }, [isDemo]);

  // Start/stop sync timer
  useEffect(() => {
    if (isMining) {
      lastSyncRef.current = Date.now();
      syncTimerRef.current = setInterval(syncToServer, 30000);
      return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
    } else {
      // Sync remaining data when stopping
      syncToServer();
      if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
    }
  }, [isMining, syncToServer]);

  // Sync on page unload
  useEffect(() => {
    const handleUnload = () => {
      const mineId = activeMineRef.current;
      const pending = pendingRef.current;
      if (!mineId || pending.actions === 0) return;
      navigator.sendBeacon("/api/game/sync-mining", JSON.stringify({ mine_id: mineId, ...pending }));
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Local mine action — instant, no API call
  const performLocalMineAction = useCallback(() => {
    const mineId = activeMineRef.current;
    if (!mineId) return;

    const mine = mines.find((m) => m.id === mineId);
    if (!mine) return;

    const droppedItem = rollLoot(mine.slug);
    const mastery = masteryLevels[mineId] ?? 0;
    const doubleChance = getMasteryDoubleDropChance(mastery);
    const isDouble = Math.random() < doubleChance;
    const qty = isDouble ? 2 : 1;

    // Update local inventory
    setInventory((prev) => {
      const existing = prev.find((i) => i.item_type === droppedItem);
      if (existing) {
        return prev.map((i) => i.item_type === droppedItem ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: droppedItem, quantity: qty, created_at: "" }];
    });

    // Update local XP
    const xpMining = mine.xp_mining;
    const xpMastery = mine.xp_mastery;
    const xpBody = mine.xp_body;

    setMiningXp((prev) => {
      const newXp = prev + xpMining;
      if (newXp >= miningXpMax) {
        setMiningLevel((l) => Math.min(l + 1, 99));
        const nextMax = melvorXpForLevel(miningLevel + 2) - melvorXpForLevel(miningLevel + 1);
        setMiningXpMax(nextMax);
        return newXp - miningXpMax;
      }
      return newXp;
    });

    // Accumulate pending sync data
    pendingRef.current.actions += 1;
    pendingRef.current.elapsed_ms += 3000;
    pendingRef.current.drops[droppedItem] = (pendingRef.current.drops[droppedItem] ?? 0) + qty;
    pendingRef.current.xp.mining += xpMining;
    pendingRef.current.xp.mastery += xpMastery;
    pendingRef.current.xp.body += xpBody;

    // Show notifications
    notifIdRef.current += 1;
    const dropInfo = ITEM_DISPLAY[droppedItem];
    const currentQty = (inventory.find((i) => i.item_type === droppedItem)?.quantity ?? 0) + qty;

    setNotifications((prev) => [...prev.slice(-8),
      { id: notifIdRef.current, type: "drop", icon: dropInfo?.icon ?? "○", label: dropInfo?.name ?? droppedItem, amount: qty, total: currentQty, color: dropInfo?.rarity === "rare" ? "text-spirit-gold" : dropInfo?.rarity === "uncommon" ? "text-jade" : "text-foreground", timestamp: Date.now() },
      { id: ++notifIdRef.current, type: "xp", icon: "⛏", label: "挖礦經驗", amount: xpMining, color: "text-blue-400", timestamp: Date.now() },
      { id: ++notifIdRef.current, type: "xp", icon: "🏆", label: "精通經驗", amount: xpMastery, color: "text-cinnabar", timestamp: Date.now() },
      { id: ++notifIdRef.current, type: "xp", icon: "✨", label: "練體經驗", amount: xpBody, color: "text-spirit-gold", timestamp: Date.now() },
    ]);
  }, [mines, masteryLevels, miningLevel, miningXpMax, inventory, isDemo]);

  // Mining tick — 3 second local cycle, zero latency
  useEffect(() => {
    if (!isMining || !activeMine) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    const intervalMs = 3000;
    lastTickRef.current = Date.now();
    accumulatedRef.current = 0;

    tickRef.current = setInterval(() => {
      if (!isMiningRef.current) return;
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      accumulatedRef.current += delta;

      if (accumulatedRef.current >= intervalMs) {
        accumulatedRef.current -= intervalMs;
        setActionProgress(0);
        performLocalMineAction();
      } else {
        setActionProgress((accumulatedRef.current / intervalMs) * 100);
      }
    }, 50);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isMining, activeMine, performLocalMineAction]);

  // Select mine and start mining
  const handleSelectMine = (mine: MineInfo) => {
    if (activeMine === mine.id && isMining) {
      // Click active mine → stop
      setIsMining(false);
      setActiveMine(null);
      setActionProgress(0);
      globalStop();
      return;
    }

    setActiveMine(mine.id);
    setIsMining(true);
    setActionProgress(0);
    accumulatedRef.current = 0;
    globalStart(mine.id);

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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="text-xl">⛏</span>
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold sm:text-2xl">挖礦</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400 font-heading px-3 py-1 text-sm">
              技能等級 {miningLevel}
            </Badge>
            <Badge variant="outline" className="border-border/40 text-muted-foreground tabular-nums px-3 py-1 text-sm">
              技能經驗 {miningXp.toLocaleString()} / {miningXpMax.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Skill XP bar */}
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${xpPercent}%` }}
          />
        </div>

        {/* === Action Info Panel === */}
        <Card className="mb-6 scroll-surface">
          <CardContent className="py-4">
            {/* Progress bar */}
            <div className="h-7 w-full overflow-hidden rounded-lg bg-muted/20 border border-border/20">
              {isMining && activeMine && (
                <div
                  className="h-full rounded-lg bg-gradient-to-r from-jade/70 to-jade transition-all duration-75 ease-linear"
                  style={{ width: `${actionProgress}%` }}
                />
              )}
            </div>

            {/* Stats or idle message */}
            {isMining && activeMine ? (
              <div className="mt-3 flex items-center justify-center gap-5 text-sm">
                {(() => {
                  const mine = mines.find((m) => m.id === activeMine);
                  if (!mine) return null;
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-400">⛏</span>
                        <span className="text-muted-foreground">XP</span>
                        <span className="font-bold tabular-nums text-blue-400">{mine.xp_mining}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-cinnabar">🏆</span>
                        <span className="text-muted-foreground">精通</span>
                        <span className="font-bold tabular-nums text-cinnabar">{mine.xp_mastery}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-spirit-gold">✨</span>
                        <span className="text-muted-foreground">練體</span>
                        <span className="font-bold tabular-nums text-spirit-gold">{mine.xp_body}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>⏱</span>
                        <span className="font-bold tabular-nums text-foreground">3.00 秒</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="mt-3 text-center text-sm text-muted-foreground/50">
                你的挖礦行動資訊會顯示在此。
              </p>
            )}
          </CardContent>
        </Card>

        {/* === Mine Grid === */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {mines.map((mine) => {
            const isLocked = miningLevel < mine.required_level;
            const isActive = activeMine === mine.id && isMining;
            const mastery = masteryLevels[mine.id] ?? 0;

            return (
              <button
                key={mine.id}
                onClick={() => !isLocked && handleSelectMine(mine)}
                disabled={isLocked}
                className="text-left w-full"
              >
                <Card className={`transition-all duration-200 h-full overflow-hidden ${
                  isActive
                    ? "border-jade shadow-lg shadow-jade/10"
                    : isLocked
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:shadow-md hover:-translate-y-0.5 cursor-pointer border-border/40"
                }`}>
                  {/* Top color strip */}
                  <div className={`h-1 ${isActive ? "bg-jade" : isLocked ? "bg-destructive/50" : "bg-border/30"}`} />

                  <CardContent className="flex flex-col items-center gap-3 py-5 px-3">
                    {/* Mine name */}
                    <p className="font-heading text-sm font-bold text-center">
                      {isLocked ? "未解鎖" : mine.name}
                    </p>

                    {/* Mine icon */}
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? "bg-jade-dim/50 border border-jade/30"
                        : isLocked
                          ? "bg-muted/10 border border-border/20"
                          : "bg-muted/15 border border-border/30 group-hover:bg-muted/25"
                    }`}>
                      <span className={`text-2xl ${isLocked ? "opacity-30 grayscale" : ""}`}>⛏</span>
                    </div>

                    {/* Stats row */}
                    {!isLocked && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="text-blue-400 font-bold">XP</span>
                          <span className="tabular-nums text-muted-foreground">{mine.xp_mining}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-cinnabar">🏆</span>
                          <span className="tabular-nums text-muted-foreground">{mine.xp_mastery}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-spirit-gold">✨</span>
                          <span className="tabular-nums text-muted-foreground">{mine.xp_body}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>⏱</span>
                          <span className="tabular-nums text-muted-foreground">3s</span>
                        </div>
                      </div>
                    )}

                    {/* Mastery */}
                    {!isLocked && mastery > 0 && (
                      <div className="w-full">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">🏆 精通</span>
                          <span className="tabular-nums text-cinnabar font-bold">{mastery}</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/30">
                          <div className="h-full rounded-full bg-cinnabar/60" style={{ width: "35%" }} />
                        </div>
                      </div>
                    )}

                    {/* Lock badge or active indicator */}
                    {isLocked ? (
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                        需要 Lv.{mine.required_level}
                      </Badge>
                    ) : isActive ? (
                      <Badge className="bg-jade text-primary-foreground text-[10px] animate-pulse">
                        挖礦中
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating notifications */}
      <FloatingNotifications items={notifications} />
    </div>
  );
}
