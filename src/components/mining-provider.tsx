"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getMasteryDoubleDropChance, melvorXpForLevel } from "@/lib/types";
import type { InventoryItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Item display names (for notifications)
// ---------------------------------------------------------------------------

const ITEM_NAMES: Record<string, { name: string; icon: string; color: string }> = {
  coal: { name: "煤", icon: "◆", color: "text-foreground" },
  copper_ore: { name: "銅礦", icon: "◇", color: "text-jade" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "✦", color: "text-spirit-gold" },
};

// ---------------------------------------------------------------------------
// Loot tables
// ---------------------------------------------------------------------------

const LOOT_TABLES: Record<string, { item_type: string; probability: number }[]> = {
  depleted_vein: [
    { item_type: "coal", probability: 0.5 },
    { item_type: "copper_ore", probability: 0.35 },
    { item_type: "spirit_stone_fragment", probability: 0.15 },
  ],
};

function rollLoot(slug: string): string {
  const table = LOOT_TABLES[slug] ?? LOOT_TABLES["depleted_vein"];
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.probability;
    if (roll <= cumulative) return entry.item_type;
  }
  return table[table.length - 1].item_type;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MineData {
  id: string;
  slug: string;
  xp_mining: number;
  xp_mastery: number;
  xp_body: number;
}

export interface Notification {
  id: number;
  icon: string;
  label: string;
  amount: number;
  total?: number;
  color: string;
  timestamp: number;
}

export interface PendingOfflineRewards {
  minutes_away: number;
  total_actions: number;
  drops: Record<string, number>;
  xp_gained: { mining: number; mastery: number; body: number };
  activity: string;
}

export interface GameState {
  isMining: boolean;
  activeMineId: string | null;
  actionProgress: number;
  miningLevel: number;
  miningXp: number;
  miningXpMax: number;
  masteryLevels: Record<string, number>;
  masteryXps: Record<string, number>;
  masteryXpMaxs: Record<string, number>;
  bodyStage: number;
  bodyXp: number;
  inventory: InventoryItem[];
  notifications: Notification[];
  pendingOfflineRewards: PendingOfflineRewards | null;
}

interface GameContextValue extends GameState {
  startMining: (mine: MineData) => void;
  stopMining: () => void;
  dismissOfflineRewards: () => void;
  updateInventory: (updater: (prev: InventoryItem[]) => InventoryItem[]) => void;
}

const GameContext = createContext<GameContextValue>(null!);

export function useGameState() {
  return useContext(GameContext);
}

// Backward compat
export function useMining() {
  const ctx = useContext(GameContext);
  return {
    isMining: ctx.isMining,
    startMining: (mineId: string) => {
      ctx.startMining({ id: mineId, slug: "depleted_vein", xp_mining: 5, xp_mastery: 3, xp_body: 5 });
    },
    stopMining: ctx.stopMining,
    pauseBackground: () => {},
    resumeBackground: () => {},
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ProviderProps {
  children: React.ReactNode;
  initialStatus: { isMining: boolean; mineId: string | null };
  initialState?: {
    miningLevel?: number;
    miningXp?: number;
    miningXpMax?: number;
    masteryLevels?: Record<string, number>;
    masteryXps?: Record<string, number>;
    masteryXpMaxs?: Record<string, number>;
    bodyStage?: number;
    bodyXp?: number;
    inventory?: InventoryItem[];
    activeMine?: MineData;
  };
}

export function MiningProvider({ children, initialStatus, initialState }: ProviderProps) {
  const initialMine = initialState?.activeMine && initialStatus.isMining ? initialState.activeMine : null;

  // --- Core state ---
  const [isMining, setIsMining] = useState(!!initialMine);
  const [activeMineId, setActiveMineId] = useState<string | null>(initialMine?.id ?? null);
  const [actionProgress, setActionProgress] = useState(0);
  const [miningLevel, setMiningLevel] = useState(initialState?.miningLevel ?? 1);
  const [miningXp, setMiningXp] = useState(initialState?.miningXp ?? 0);
  const [miningXpMax, setMiningXpMax] = useState(initialState?.miningXpMax ?? 83);
  const [masteryLevels, setMasteryLevels] = useState(initialState?.masteryLevels ?? {});
  const [masteryXps, setMasteryXps] = useState(initialState?.masteryXps ?? {});
  const [masteryXpMaxs, setMasteryXpMaxs] = useState(initialState?.masteryXpMaxs ?? {});
  const [bodyStage] = useState(initialState?.bodyStage ?? 1);
  const [bodyXp, setBodyXp] = useState(initialState?.bodyXp ?? 0);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialState?.inventory ?? []);

  // --- Notifications (system 1) ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifIdRef = useRef(0);

  // --- Offline rewards (system 2) ---
  const [pendingOfflineRewards, setPendingOfflineRewards] = useState<PendingOfflineRewards | null>(null);

  // --- Refs ---
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());
  const accumulatedRef = useRef(0);
  const activeMineRef = useRef<MineData | null>(initialMine);
  const isMiningRef = useRef(isMining);
  isMiningRef.current = isMining;
  const bodyStageRef = useRef(bodyStage);
  const miningLevelRef = useRef(miningLevel);
  const miningXpMaxRef = useRef(miningXpMax);
  const masteryLevelsRef = useRef(masteryLevels);
  const masteryXpMaxsRef = useRef(masteryXpMaxs);
  miningLevelRef.current = miningLevel;
  miningXpMaxRef.current = miningXpMax;
  masteryLevelsRef.current = masteryLevels;
  masteryXpMaxsRef.current = masteryXpMaxs;

  // --- Sync ---
  const pendingRef = useRef({ actions: 0, elapsed_ms: 0, drops: {} as Record<string, number>, xp: { mining: 0, mastery: 0, body: 0 } });

  const syncToServer = useCallback(async () => {
    const mine = activeMineRef.current;
    const pending = pendingRef.current;
    if (!mine || pending.actions === 0) return;

    const toSync = { ...pending, drops: { ...pending.drops }, xp: { ...pending.xp } };
    pendingRef.current = { actions: 0, elapsed_ms: 0, drops: {}, xp: { mining: 0, mastery: 0, body: 0 } };

    try {
      await fetch("/api/game/sync-mining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mine_id: mine.id, ...toSync }),
      });
    } catch {
      const p = pendingRef.current;
      p.actions += toSync.actions;
      p.elapsed_ms += toSync.elapsed_ms;
      for (const [k, v] of Object.entries(toSync.drops)) p.drops[k] = (p.drops[k] ?? 0) + v;
      p.xp.mining += toSync.xp.mining;
      p.xp.mastery += toSync.xp.mastery;
      p.xp.body += toSync.xp.body;
    }
  }, []);

  // Sync every 30s while mining
  useEffect(() => {
    if (isMining) {
      const timer = setInterval(syncToServer, 30000);
      return () => clearInterval(timer);
    } else {
      syncToServer();
    }
  }, [isMining, syncToServer]);

  // Sync on page unload
  useEffect(() => {
    const handleUnload = () => {
      const mine = activeMineRef.current;
      const pending = pendingRef.current;
      if (!mine || pending.actions === 0) return;
      navigator.sendBeacon("/api/game/sync-mining", JSON.stringify({ mine_id: mine.id, ...pending }));
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // --- Clean old notifications ---
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => Date.now() - n.timestamp < 2500));
    }, 2600);
    return () => clearTimeout(timer);
  }, [notifications]);

  // --- Add notification helper ---
  const addNotification = useCallback((icon: string, label: string, amount: number, color: string, total?: number) => {
    notifIdRef.current += 1;
    setNotifications((prev) => [...prev.slice(-10), {
      id: notifIdRef.current, icon, label, amount, total, color, timestamp: Date.now(),
    }]);
  }, []);

  // --- Local mine action (system 1: produces notifications) ---
  const doLocalMineAction = useCallback(() => {
    const mine = activeMineRef.current;
    if (!mine) return;

    const droppedItem = rollLoot(mine.slug);
    const mastery = masteryLevelsRef.current[mine.id] ?? 0;
    const isDouble = Math.random() < getMasteryDoubleDropChance(mastery);
    const qty = isDouble ? 2 : 1;

    // Update inventory
    let newTotal = qty;
    setInventory((prev) => {
      const existing = prev.find((i) => i.item_type === droppedItem);
      if (existing) {
        newTotal = existing.quantity + qty;
        return prev.map((i) => i.item_type === droppedItem ? { ...i, quantity: existing.quantity + qty } : i);
      }
      return [...prev, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: droppedItem, quantity: qty, created_at: "" }];
    });

    // Update mining XP
    setMiningXp((prev) => {
      const newXp = prev + mine.xp_mining;
      if (newXp >= miningXpMaxRef.current) {
        setMiningLevel((l) => Math.min(l + 1, 99));
        const nextLevel = miningLevelRef.current + 1;
        setMiningXpMax(melvorXpForLevel(nextLevel + 1) - melvorXpForLevel(nextLevel));
        return newXp - miningXpMaxRef.current;
      }
      return newXp;
    });

    // Update mastery XP
    setMasteryXps((prev) => {
      const cur = (prev[mine.id] ?? 0) + mine.xp_mastery;
      const max = masteryXpMaxsRef.current[mine.id] ?? 83;
      if (cur >= max) {
        setMasteryLevels((ml) => ({ ...ml, [mine.id]: (ml[mine.id] ?? 1) + 1 }));
        const newLvl = (masteryLevelsRef.current[mine.id] ?? 1) + 1;
        setMasteryXpMaxs((mx) => ({ ...mx, [mine.id]: melvorXpForLevel(newLvl + 1) - melvorXpForLevel(newLvl) }));
        return { ...prev, [mine.id]: cur - max };
      }
      return { ...prev, [mine.id]: cur };
    });

    // Update body XP (with cap)
    setBodyXp((prev) => {
      const stage = bodyStageRef.current;
      if (stage >= 10) return prev;
      const maxXp = melvorXpForLevel(stage + 1) - melvorXpForLevel(stage);
      return Math.min(prev + mine.xp_body, maxXp);
    });

    // Accumulate sync data
    const p = pendingRef.current;
    p.actions += 1;
    p.elapsed_ms += 3000;
    p.drops[droppedItem] = (p.drops[droppedItem] ?? 0) + qty;
    p.xp.mining += mine.xp_mining;
    p.xp.mastery += mine.xp_mastery;
    p.xp.body += mine.xp_body;

    // === SYSTEM 1: Global notifications (staggered 0.5s apart) ===
    const itemInfo = ITEM_NAMES[droppedItem];
    addNotification(itemInfo?.icon ?? "○", itemInfo?.name ?? droppedItem, qty, itemInfo?.color ?? "text-foreground", newTotal);
    setTimeout(() => addNotification("⛏", "挖礦經驗", mine.xp_mining, "text-blue-400"), 500);
    setTimeout(() => addNotification("🏆", "精通經驗", mine.xp_mastery, "text-cinnabar"), 1000);
    setTimeout(() => addNotification("💪", "練體經驗", mine.xp_body, "text-spirit-gold"), 1500);
  }, [addNotification]);

  // --- Mining tick ---
  useEffect(() => {
    if (!isMining) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    lastTickRef.current = Date.now();
    accumulatedRef.current = 0;

    tickRef.current = setInterval(() => {
      if (!isMiningRef.current) return;

      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      accumulatedRef.current += delta;

      if (accumulatedRef.current >= 3000) {
        accumulatedRef.current -= 3000;
        setActionProgress(0);
        doLocalMineAction();
      } else {
        setActionProgress((accumulatedRef.current / 3000) * 100);
      }
    }, 50);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isMining, doLocalMineAction]);

  // === SYSTEM 2: Unified offline rewards (visibility + page load) ===
  const hiddenAtRef = useRef<number | null>(null);
  const offlineCheckedRef = useRef(false);

  // Calculate offline rewards for a given number of minutes
  const calculateOfflineRewards = useCallback((awayMinutes: number, mine: MineData): PendingOfflineRewards => {
    const effectiveMinutes = Math.min(awayMinutes, 720); // 12h cap
    const totalActions = effectiveMinutes * 20;

    const drops: Record<string, number> = {};
    for (let i = 0; i < totalActions; i++) {
      const item = rollLoot(mine.slug);
      drops[item] = (drops[item] ?? 0) + 1;
    }

    return {
      minutes_away: effectiveMinutes,
      total_actions: totalActions,
      drops,
      xp_gained: {
        mining: totalActions * mine.xp_mining,
        mastery: totalActions * mine.xp_mastery,
        body: totalActions * mine.xp_body,
      },
      activity: "挖礦",
    };
  }, []);

  // Dismiss offline rewards → apply + resume
  const dismissOfflineRewards = useCallback(() => {
    if (!pendingOfflineRewards) return;
    const rewards = pendingOfflineRewards;

    // Apply drops to inventory
    for (const [itemType, qty] of Object.entries(rewards.drops)) {
      setInventory((prev) => {
        const existing = prev.find((it) => it.item_type === itemType);
        if (existing) return prev.map((it) => it.item_type === itemType ? { ...it, quantity: it.quantity + qty } : it);
        return [...prev, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: itemType, quantity: qty, created_at: "" }];
      });
    }

    // Apply XP
    setMiningXp((prev) => prev + rewards.xp_gained.mining);
    setBodyXp((prev) => {
      if (bodyStageRef.current >= 10) return prev;
      const maxXp = melvorXpForLevel(bodyStageRef.current + 1) - melvorXpForLevel(bodyStageRef.current);
      return Math.min(prev + rewards.xp_gained.body, maxXp);
    });

    // Queue sync
    if (activeMineRef.current) {
      const p = pendingRef.current;
      p.actions += rewards.total_actions;
      p.elapsed_ms += rewards.minutes_away * 60_000;
      for (const [k, v] of Object.entries(rewards.drops)) p.drops[k] = (p.drops[k] ?? 0) + v;
      p.xp.mining += rewards.xp_gained.mining;
      p.xp.mastery += rewards.xp_gained.mastery;
      p.xp.body += rewards.xp_gained.body;
      syncToServer();
    }

    setPendingOfflineRewards(null);
    // Mining continues (was never paused for offline rewards)
  }, [pendingOfflineRewards, syncToServer]);

  // Visibility handler
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // User left → record time, sync
        hiddenAtRef.current = Date.now();
        if (isMiningRef.current) syncToServer();
      } else if (hiddenAtRef.current && isMiningRef.current && activeMineRef.current) {
        // User returned
        const awayMs = Date.now() - hiddenAtRef.current;
        const awayMinutes = Math.floor(awayMs / 60_000);
        hiddenAtRef.current = null;

        if (awayMinutes >= 1) {
          const rewards = calculateOfflineRewards(awayMinutes, activeMineRef.current);
          setPendingOfflineRewards(rewards);
          // Mining tick continues — rewards are bonus, not replacement
        }

        // Reset tick timing regardless
        accumulatedRef.current = 0;
        lastTickRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncToServer, calculateOfflineRewards]);

  // Page load: check if returning from closed browser (only once)
  useEffect(() => {
    if (offlineCheckedRef.current) return;
    offlineCheckedRef.current = true;

    if (!initialStatus.isMining || !initialMine) return;

    // Check sessionStorage to avoid double-showing
    const lastCheck = sessionStorage.getItem("offline-rewards-checked");
    if (lastCheck) return;

    // Call API to check time since last session
    fetch("/api/game/offline-rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && data.total_actions > 0) {
          setPendingOfflineRewards({
            minutes_away: data.minutes_away,
            total_actions: data.total_actions,
            drops: Object.fromEntries((data.drops ?? []).map((d: { item_type: string; quantity: number }) => [d.item_type, d.quantity])),
            xp_gained: data.xp_gained ?? { mining: 0, mastery: 0, body: 0 },
            activity: "挖礦",
          });
        }
        sessionStorage.setItem("offline-rewards-checked", Date.now().toString());
      })
      .catch(() => {
        sessionStorage.setItem("offline-rewards-checked", Date.now().toString());
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---
  const startMining = useCallback((mine: MineData) => {
    activeMineRef.current = mine;
    setActiveMineId(mine.id);
    setIsMining(true);
    accumulatedRef.current = 0;
  }, []);

  const stopMining = useCallback(() => {
    syncToServer();
    setIsMining(false);
    setActiveMineId(null);
    activeMineRef.current = null;
    setActionProgress(0);
  }, [syncToServer]);

  // --- Context value ---
  const value: GameContextValue = {
    isMining, activeMineId, actionProgress,
    miningLevel, miningXp, miningXpMax,
    masteryLevels, masteryXps, masteryXpMaxs,
    bodyStage, bodyXp, inventory,
    notifications, pendingOfflineRewards,
    startMining, stopMining, dismissOfflineRewards,
    updateInventory: setInventory,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
