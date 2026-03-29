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

  // Mine action
  const performMineAction = useCallback(async () => {
    const mineId = activeMineRef.current;
    if (!mineId || isDemo) return;

    try {
      const res = await fetch("/api/game/mine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mine_id: mineId }),
      });

      if (res.status === 429 || res.status === 409 || !res.ok) return;

      const data = await res.json();
      const { drop, xp, levels, totals } = data;

      // Update state from server
      setMiningLevel(levels.mining);
      setMiningXp(totals.mining_xp);
      setMiningXpMax(totals.mining_xp_max);
      setMasteryLevels((prev) => ({ ...prev, [mineId]: levels.mastery }));

      // Update inventory
      setInventory((prev) => {
        const existing = prev.find((i) => i.item_type === drop.item_type);
        if (existing) {
          return prev.map((i) => i.item_type === drop.item_type ? { ...i, quantity: drop.total_quantity } : i);
        }
        return [...prev, { id: crypto.randomUUID(), user_id: "s", slot: 1, item_type: drop.item_type, quantity: drop.total_quantity, created_at: "" }];
      });

      // Notifications
      notifIdRef.current += 1;
      const dropInfo = ITEM_DISPLAY[drop.item_type];
      const dropNotif: DropNotification = {
        id: notifIdRef.current,
        type: "drop",
        icon: dropInfo?.icon ?? "○",
        label: dropInfo?.name ?? drop.item_type,
        amount: drop.quantity,
        total: drop.total_quantity,
        color: dropInfo?.rarity === "rare" ? "text-spirit-gold" : dropInfo?.rarity === "uncommon" ? "text-jade" : "text-foreground",
        timestamp: Date.now(),
      };

      const xpNotifs: DropNotification[] = [
        { id: ++notifIdRef.current, type: "xp", icon: "⛏", label: "采掘經驗", amount: xp.mining, color: "text-jade", timestamp: Date.now() },
        { id: ++notifIdRef.current, type: "xp", icon: "🏆", label: "精通經驗", amount: xp.mastery, color: "text-cinnabar", timestamp: Date.now() },
        { id: ++notifIdRef.current, type: "xp", icon: "✨", label: "練體經驗", amount: xp.body, color: "text-spirit-gold", timestamp: Date.now() },
      ];

      setNotifications((prev) => [...prev.slice(-8), dropNotif, ...xpNotifs]);
    } catch {
      // Network error
    }
  }, [isDemo]);

  // Mining tick
  useEffect(() => {
    if (!isMining || !activeMine) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    const mine = mines.find((m) => m.id === activeMine);
    const intervalMs = 3000; // TODO: use mine-specific interval

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
        if (!inFlightRef.current) {
          inFlightRef.current = true;
          performMineAction().finally(() => { inFlightRef.current = false; });
        }
      } else {
        setActionProgress((accumulatedRef.current / intervalMs) * 100);
      }
    }, 50);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isMining, activeMine, mines, performMineAction]);

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
        {/* Header — skill info bar */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              采掘
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-jade/30 text-jade font-heading px-3 py-1">
                Lv.{miningLevel}
              </Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                {miningXp.toLocaleString()} / {miningXpMax.toLocaleString()} XP
              </span>
            </div>
          </div>

          {/* Skill XP bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-jade transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Progress bar — only when mining */}
        {isMining && activeMine && (
          <div className="mb-6 space-y-2">
            <div className="h-6 w-full overflow-hidden rounded-lg bg-muted/30 border border-border/30">
              <div
                className="h-full rounded-lg bg-gradient-to-r from-jade/80 to-jade transition-all duration-75 ease-linear"
                style={{ width: `${actionProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              {(() => {
                const mine = mines.find((m) => m.id === activeMine);
                if (!mine) return null;
                return (
                  <>
                    <span>⛏ XP <span className="text-jade tabular-nums">{mine.xp_mining}</span></span>
                    <span>🏆 精通 <span className="text-cinnabar tabular-nums">{mine.xp_mastery}</span></span>
                    <span>✨ 練體 <span className="text-spirit-gold tabular-nums">{mine.xp_body}</span></span>
                    <span>⏱ <span className="text-foreground tabular-nums">3.00</span> 秒</span>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Mine grid */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {mines.map((mine) => {
            const isLocked = miningLevel < mine.required_level;
            const isActive = activeMine === mine.id && isMining;
            const mastery = masteryLevels[mine.id] ?? 0;

            return (
              <button
                key={mine.id}
                onClick={() => !isLocked && handleSelectMine(mine)}
                disabled={isLocked}
                className="text-left"
              >
                <Card className={`scroll-surface transition-all duration-200 h-full ${
                  isActive
                    ? "border-jade ring-2 ring-jade/30 shadow-lg"
                    : isLocked
                      ? "opacity-40 border-dashed cursor-not-allowed"
                      : "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer border-border/50"
                }`}>
                  <CardContent className="flex flex-col items-center gap-2 py-5">
                    {/* Mine name */}
                    <p className="font-heading text-sm font-bold text-center">
                      {isLocked ? "未解鎖" : mine.name}
                    </p>

                    {/* Stats */}
                    {!isLocked && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>XP <span className="text-jade">{mine.xp_mining}</span></span>
                        <span>·</span>
                        <span>⏱ 3s</span>
                      </div>
                    )}

                    {/* Mine icon / rock */}
                    <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${
                      isActive ? "bg-jade-dim border border-jade/30" : "bg-muted/20 border border-border/30"
                    }`}>
                      <span className="text-3xl">⛏</span>
                    </div>

                    {/* Level requirement or mastery */}
                    {isLocked ? (
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                        Lv.{mine.required_level}
                      </Badge>
                    ) : mastery > 0 ? (
                      <div className="w-full space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">🏆 {mastery}</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Active indicator */}
                    {isActive && (
                      <Badge className="bg-jade text-primary-foreground text-[10px]">
                        采掘中
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {/* Inventory summary */}
        {inventory.length > 0 && (
          <div className="mt-6 rounded-lg bg-card/60 border border-border/30 p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {inventory.map((item) => {
                const info = ITEM_DISPLAY[item.item_type];
                return (
                  <div key={item.item_type} className="flex items-center gap-1.5 text-sm">
                    <span className={info?.rarity === "rare" ? "text-spirit-gold" : info?.rarity === "uncommon" ? "text-jade" : "text-foreground"}>
                      {info?.icon ?? "○"}
                    </span>
                    <span className="text-muted-foreground">{info?.name}</span>
                    <span className="tabular-nums font-medium">{item.quantity.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating notifications */}
      <FloatingNotifications items={notifications} />
    </div>
  );
}
