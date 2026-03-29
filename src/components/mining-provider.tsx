"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getMasteryDoubleDropChance, melvorXpForLevel } from "@/lib/types";
import type { InventoryItem } from "@/lib/types";

// Loot tables (same as mining page)
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

export interface MineData {
  id: string;
  slug: string;
  xp_mining: number;
  xp_mastery: number;
  xp_body: number;
}

export interface GameState {
  // Mining status
  isMining: boolean;
  activeMineId: string | null;
  actionProgress: number;

  // Skills
  miningLevel: number;
  miningXp: number;
  miningXpMax: number;
  masteryLevels: Record<string, number>;
  masteryXps: Record<string, number>;
  masteryXpMaxs: Record<string, number>;
  bodyStage: number;
  bodyXp: number;

  // Inventory
  inventory: InventoryItem[];
}

interface GameContextValue extends GameState {
  startMining: (mine: MineData) => void;
  stopMining: () => void;
  pauseLocalMining: () => void;
  resumeLocalMining: () => void;
  updateInventory: (updater: (prev: InventoryItem[]) => InventoryItem[]) => void;
}

const GameContext = createContext<GameContextValue>(null!);

export function useGameState() {
  return useContext(GameContext);
}

// For backward compat
export function useMining() {
  const ctx = useContext(GameContext);
  return {
    isMining: ctx.isMining,
    startMining: (mineId: string) => {
      // Find mine from ref — caller should use startMining(mine) instead
      ctx.startMining({ id: mineId, slug: "depleted_vein", xp_mining: 5, xp_mastery: 3, xp_body: 5 });
    },
    stopMining: ctx.stopMining,
    pauseBackground: ctx.pauseLocalMining,
    resumeBackground: ctx.resumeLocalMining,
  };
}

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
    activeMineSlug?: string;
  };
}

export function MiningProvider({ children, initialStatus, initialState }: ProviderProps) {
  const [isMining, setIsMining] = useState(initialStatus.isMining);
  const [activeMineId, setActiveMineId] = useState<string | null>(initialStatus.mineId);
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

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());
  const accumulatedRef = useRef(0);
  const pausedRef = useRef(false);
  const activeMineRef = useRef<MineData | null>(null);
  const isMiningRef = useRef(isMining);
  isMiningRef.current = isMining;

  // Sync pending data
  const pendingRef = useRef({ actions: 0, elapsed_ms: 0, drops: {} as Record<string, number>, xp: { mining: 0, mastery: 0, body: 0 } });
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State refs for callbacks
  const miningLevelRef = useRef(miningLevel);
  const miningXpMaxRef = useRef(miningXpMax);
  const masteryLevelsRef = useRef(masteryLevels);
  const masteryXpMaxsRef = useRef(masteryXpMaxs);
  miningLevelRef.current = miningLevel;
  miningXpMaxRef.current = miningXpMax;
  masteryLevelsRef.current = masteryLevels;
  masteryXpMaxsRef.current = masteryXpMaxs;

  // Sync to server
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
      // Restore on failure
      const p = pendingRef.current;
      p.actions += toSync.actions;
      p.elapsed_ms += toSync.elapsed_ms;
      for (const [k, v] of Object.entries(toSync.drops)) p.drops[k] = (p.drops[k] ?? 0) + v;
      p.xp.mining += toSync.xp.mining;
      p.xp.mastery += toSync.xp.mastery;
      p.xp.body += toSync.xp.body;
    }
  }, []);

  // Sync timer
  useEffect(() => {
    if (isMining) {
      syncTimerRef.current = setInterval(syncToServer, 30000);
      return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
    } else {
      syncToServer();
      if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
    }
  }, [isMining, syncToServer]);

  // Sync on unload
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

  // Local mine action
  const doLocalMineAction = useCallback(() => {
    const mine = activeMineRef.current;
    if (!mine) return;

    const droppedItem = rollLoot(mine.slug);
    const mastery = masteryLevelsRef.current[mine.id] ?? 0;
    const isDouble = Math.random() < getMasteryDoubleDropChance(mastery);
    const qty = isDouble ? 2 : 1;

    // Update inventory
    setInventory((prev) => {
      const existing = prev.find((i) => i.item_type === droppedItem);
      if (existing) return prev.map((i) => i.item_type === droppedItem ? { ...i, quantity: i.quantity + qty } : i);
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

    // Update body XP
    setBodyXp((prev) => prev + mine.xp_body);

    // Accumulate sync data
    const p = pendingRef.current;
    p.actions += 1;
    p.elapsed_ms += 3000;
    p.drops[droppedItem] = (p.drops[droppedItem] ?? 0) + qty;
    p.xp.mining += mine.xp_mining;
    p.xp.mastery += mine.xp_mastery;
    p.xp.body += mine.xp_body;
  }, []);

  // Mining tick
  useEffect(() => {
    if (!isMining) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    lastTickRef.current = Date.now();
    accumulatedRef.current = 0;

    tickRef.current = setInterval(() => {
      if (!isMiningRef.current || pausedRef.current) return;

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

  const startMining = useCallback((mine: MineData) => {
    activeMineRef.current = mine;
    setActiveMineId(mine.id);
    setIsMining(true);
    accumulatedRef.current = 0;
  }, []);

  const stopMining = useCallback(() => {
    setIsMining(false);
    setActiveMineId(null);
    activeMineRef.current = null;
    setActionProgress(0);
  }, []);

  const pauseLocalMining = useCallback(() => { pausedRef.current = true; }, []);
  const resumeLocalMining = useCallback(() => { pausedRef.current = false; }, []);

  const value: GameContextValue = {
    isMining, activeMineId, actionProgress,
    miningLevel, miningXp, miningXpMax,
    masteryLevels, masteryXps, masteryXpMaxs,
    bodyStage, bodyXp, inventory,
    startMining, stopMining, pauseLocalMining, resumeLocalMining,
    updateInventory: setInventory,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
