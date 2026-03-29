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
  const { startMining: globalStart, stopMining: globalStop, pauseBackground, resumeBackground } = useMining();

  // State
  const [activeMine, setActiveMine] = useState<string | null>(activeMineId);
  const [isMining, setIsMining] = useState(!!activeMineId);
  const [miningLevel, setMiningLevel] = useState(initialLevel);
  const [miningXp, setMiningXp] = useState(initialXp);
  const [miningXpMax, setMiningXpMax] = useState(initialXpMax);
  const [masteryLevels, setMasteryLevels] = useState(initialMasteryLevels);
  const [masteryXps, setMasteryXps] = useState(initialMasteryXps);
  const [masteryXpMaxs, setMasteryXpMaxs] = useState(initialMasteryXpMaxs);
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

    // Update local mastery XP
    setMasteryXps((prev) => {
      const currentXp = (prev[mineId] ?? 0) + xpMastery;
      const currentMax = masteryXpMaxs[mineId] ?? 83;
      if (currentXp >= currentMax) {
        setMasteryLevels((ml) => ({ ...ml, [mineId]: (ml[mineId] ?? 1) + 1 }));
        const newLevel = (masteryLevels[mineId] ?? 1) + 1;
        setMasteryXpMaxs((mx) => ({ ...mx, [mineId]: melvorXpForLevel(newLevel + 1) - melvorXpForLevel(newLevel) }));
        return { ...prev, [mineId]: currentXp - currentMax };
      }
      return { ...prev, [mineId]: currentXp };
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
      { id: ++notifIdRef.current, type: "xp", icon: "💪", label: "練體經驗", amount: xpBody, color: "text-spirit-gold", timestamp: Date.now() },
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

        {/* === Mine Grid === */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {mines.map((mine) => {
            const isLocked = miningLevel < mine.required_level;
            const isActive = activeMine === mine.id && isMining;
            const mastery = masteryLevels[mine.id] ?? 0;
            const lootTable = LOOT_TABLES[mine.slug] ?? LOOT_TABLES["depleted_vein"];
            const circumference = 2 * Math.PI * 38; // SVG circle r=38

            return (
              <Card key={mine.id} className={`transition-all duration-200 overflow-hidden ${
                isActive
                  ? "border-jade shadow-lg shadow-jade/10"
                  : isLocked
                    ? "opacity-40"
                    : "border-border/40"
              }`}>
                {/* Top color strip */}
                <div className={`h-1 ${isActive ? "bg-jade" : isLocked ? "bg-destructive/50" : "bg-border/20"}`} />

                <CardContent className="p-4 space-y-4">
                  {/* Mine header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading text-base font-bold">
                        {isLocked ? "未解鎖" : mine.name}
                      </p>
                      {!isLocked && (
                        <p className="text-xs text-muted-foreground">
                          ⏱ {(3).toFixed(2)} 秒 · XP {mine.xp_mining}
                        </p>
                      )}
                    </div>
                    {isLocked ? (
                      <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                        需要 Lv.{mine.required_level}
                      </Badge>
                    ) : (
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
                    )}
                  </div>

                  {/* Drop rates + Progress circle row */}
                  {!isLocked && (
                    <div className="flex items-center gap-4">
                      {/* Drop rates */}
                      <div className="flex-1 space-y-1.5">
                        {lootTable.map((entry) => {
                          const info = ITEM_DISPLAY[entry.item_type];
                          return (
                            <div key={entry.item_type} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={info?.rarity === "rare" ? "text-spirit-gold" : info?.rarity === "uncommon" ? "text-jade" : "text-foreground"}>
                                  {info?.icon ?? "○"}
                                </span>
                                <span className="text-muted-foreground">{info?.name ?? entry.item_type}</span>
                              </div>
                              <span className="tabular-nums text-muted-foreground text-xs">{(entry.probability * 100).toFixed(0)}%</span>
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
                          {/* Progress */}
                          {isActive && (
                            <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeWidth="4"
                              strokeDasharray={`${(actionProgress / 100) * circumference} ${circumference}`}
                              strokeLinecap="round"
                              className="text-jade transition-all duration-75 ease-linear" />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl">⛏</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mastery with XP */}
                  {!isLocked && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          🏆 專精 <span className="font-bold text-cinnabar">{mastery}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground/70">
                          {(masteryXps[mine.id] ?? 0).toLocaleString()} / {(masteryXpMaxs[mine.id] ?? 83).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                        <div className="h-full rounded-full bg-cinnabar/60 transition-all duration-300"
                          style={{ width: `${masteryXpMaxs[mine.id] ? Math.min((masteryXps[mine.id] ?? 0) / masteryXpMaxs[mine.id] * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Action button */}
                  {!isLocked && (
                    <button
                      onClick={() => handleSelectMine(mine)}
                      className={`w-full rounded-lg py-2 text-sm font-heading font-bold transition-all duration-200 ${
                        isActive
                          ? "bg-destructive/80 text-destructive-foreground hover:bg-destructive"
                          : "bg-jade/80 text-primary-foreground hover:bg-jade"
                      }`}
                    >
                      {isActive ? "停止挖礦" : "開始挖礦"}
                    </button>
                  )}

                  {isLocked && (
                    <p className="text-center text-xs text-muted-foreground/50">
                      提升挖礦等級至 Lv.{mine.required_level} 解鎖
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Floating notifications */}
      <FloatingNotifications items={notifications} />
    </div>
  );
}
