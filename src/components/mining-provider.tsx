"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getMasteryDoubleDropChance, melvorXpForLevel, bodyXpForStage, spiritStoneBonus } from "@/lib/types";
import { COMBAT_ZONES, type Monster } from "@/lib/combat";
import { PLAYER_ATTACK_INTERVAL, calcCombatRound } from "@/lib/combat-sim";
import { ITEMS, hasTag } from "@/lib/items";
import { computeStats } from "@/lib/stats";
import type { InventoryItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Item display names (for notifications)
// ---------------------------------------------------------------------------

const ITEM_NAMES: Record<string, { nameZh: string; nameEn: string; icon: string; color: string }> = {
  coal: { nameZh: "煤", nameEn: "Coal", icon: "◆", color: "text-foreground" },
  copper_ore: { nameZh: "銅礦", nameEn: "Copper Ore", icon: "◇", color: "text-jade" },
  spirit_stone_fragment: { nameZh: "靈石碎片", nameEn: "Spirit Stone Fragment", icon: "✦", color: "text-spirit-gold" },
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
  xp_gained: { mining: number; mastery: number; body: number; qi?: number };
  activity: string;
  combat?: { kills: number; died: boolean };
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
  realm: string;
  inventory: InventoryItem[];
  notifications: Notification[];
  pendingOfflineRewards: PendingOfflineRewards | null;
  isMeditating: boolean;
  qiXp: number;
  meditationProgress: number;
  equipment: Record<string, string>;
  equipmentSets: Record<string, Record<string, string>>;
  activeEquipmentSet: number;
  bodyLevel: number;
  lootBox: { item_type: string; quantity: number }[];
  // Combat
  isCombating: boolean;
  combatMonster: Monster | null;
  playerHp: number;
  playerMaxHp: number;
  monsterHp: number;
  combatPlayerProgress: number;
  combatMonsterProgress: number;
  combatKillCount: number;
  combatLogs: { id: number; text: string; color: string }[];
  combatLootSlots: { item_type: string; quantity: number }[];
}

interface GameContextValue extends GameState {
  startMining: (mine: MineData) => void;
  stopMining: () => void;
  startMeditation: () => void;
  stopMeditation: () => void;
  startCombat: (monster: Monster) => void;
  stopCombat: () => void;
  collectCombatLoot: () => Promise<{ ok: boolean; error?: string }>;
  updateQiArray: (next: (string | null)[]) => void;
  addNotification: (icon: string, label: string, amount: number, color: string, total?: number) => void;
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
    realm?: string;
    isMeditating?: boolean;
    qiXp?: number;
    equipment?: Record<string, string>;
    equipmentSets?: Record<string, Record<string, string>>;
    activeEquipmentSet?: number;
    bodyLevel?: number;
    lootBox?: { item_type: string; quantity: number }[];
    qiArray?: (string | null)[];
    offlineRewards?: {
      minutes_away: number;
      session_type: "mining" | "meditate";
      drops: { item_type: string; quantity: number }[];
      xp_gained: { mining: number; mastery: number; body: number; qi?: number };
    } | null;
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
  const [bodyStage, setBodyStage] = useState(initialState?.bodyStage ?? 1);
  const [bodyXp, setBodyXp] = useState(initialState?.bodyXp ?? 0);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialState?.inventory ?? []);
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;

  // i18n — use ref to read current locale from action handlers
  const { locale } = useI18n();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // realm — as state so sidebar/UI re-render on breakthrough
  const [realm, setRealm] = useState(initialState?.realm ?? "煉體");
  const realmRef = useRef(realm);
  realmRef.current = realm;

  // Sync realm/body state when server-side layout passes new initialState (after router.refresh)
  useEffect(() => {
    if (initialState?.realm && initialState.realm !== realm) {
      setRealm(initialState.realm);
    }
    if (typeof initialState?.bodyStage === "number") {
      setBodyStage(initialState.bodyStage);
      bodyStageRef.current = initialState.bodyStage;
    }
    if (typeof initialState?.bodyXp === "number") {
      setBodyXp(initialState.bodyXp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState?.realm, initialState?.bodyStage, initialState?.bodyXp]);

  // --- Notifications (system 1) ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifIdRef = useRef(0);

  // --- Offline rewards (system 2) ---
  const [pendingOfflineRewards, setPendingOfflineRewards] = useState<PendingOfflineRewards | null>(() => {
    const init = initialState?.offlineRewards;
    if (!init) return null;
    return {
      minutes_away: init.minutes_away,
      total_actions: 0,
      drops: Object.fromEntries(init.drops.map((d) => [d.item_type, d.quantity])),
      xp_gained: { mining: init.xp_gained.mining ?? 0, mastery: init.xp_gained.mastery ?? 0, body: init.xp_gained.body ?? 0, qi: init.xp_gained.qi },
      activity: init.session_type === "meditate" ? "冥想" : "挖礦",
    };
  });

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

  // --- Catch-up auto-breakthrough when in post-煉體 realms ---
  // Re-runs when realm or body state changes (e.g., after breakthrough 煉體→練氣).
  useEffect(() => {
    if (realm === "煉體") return;
    let level = bodyStage;
    let xp = bodyXp;
    let breakthroughs = 0;
    while (level >= 9 && breakthroughs < 50) {
      const required = bodyXpForStage(level);
      if (xp < required) break;
      xp -= required;
      level += 1;
      breakthroughs++;
    }
    if (breakthroughs > 0) {
      setBodyStage(level);
      bodyStageRef.current = level;
      setBodyXp(xp);
      // Single call — server loops cascade on its side
      fetch("/api/game/breakthrough", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "body_peak" }) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, bodyStage, bodyXp]);

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
    const id = ++notifIdRef.current * 1000 + Math.floor(Math.random() * 1000);
    const timestamp = Date.now();
    setNotifications((prev) => [...prev.slice(-10), { id, icon, label, amount, total, color, timestamp }]);
  }, []);

  // --- Local mine action (system 1: produces notifications) ---
  const doLocalMineAction = useCallback(() => {
    const mine = activeMineRef.current;
    if (!mine) return;

    const droppedItem = rollLoot(mine.slug);
    const mastery = masteryLevelsRef.current[mine.id] ?? 0;
    const isDouble = Math.random() < getMasteryDoubleDropChance(mastery);
    const qty = isDouble ? 2 : 1;

    // Update inventory — calculate total from ref (always current)
    const currentQty = inventoryRef.current.find((i) => i.item_type === droppedItem)?.quantity ?? 0;
    const newTotal = currentQty + qty;
    setInventory((prev) => {
      const existing = prev.find((i) => i.item_type === droppedItem);
      if (existing) {
        return prev.map((i) => i.item_type === droppedItem ? { ...i, quantity: existing.quantity + qty } : i);
      }
      return [...prev, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: droppedItem, quantity: qty, created_at: "" }];
    });

    // Track level-ups for notifications
    let miningLeveledUp = false;
    let masteryLeveledUp = false;
    const bodyGainedXp = true;

    // Update mining XP
    setMiningXp((prev) => {
      const newXp = prev + mine.xp_mining;
      if (newXp >= miningXpMaxRef.current) {
        miningLeveledUp = true;
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
        masteryLeveledUp = true;
        setMasteryLevels((ml) => ({ ...ml, [mine.id]: (ml[mine.id] ?? 1) + 1 }));
        const newLvl = (masteryLevelsRef.current[mine.id] ?? 1) + 1;
        setMasteryXpMaxs((mx) => ({ ...mx, [mine.id]: melvorXpForLevel(newLvl + 1) - melvorXpForLevel(newLvl) }));
        return { ...prev, [mine.id]: cur - max };
      }
      return { ...prev, [mine.id]: cur };
    });

    // Update body XP — auto-breakthrough at 巔峰 only if not in 煉體 anymore
    setBodyXp((prev) => {
      let newXp = prev + mine.xp_body;
      // Auto-breakthrough only if past 煉體 realm (i.e., 練氣 or higher)
      if (realmRef.current !== "煉體") {
        let breakthroughs = 0;
        while (bodyStageRef.current >= 9 && breakthroughs < 50) {
          const required = bodyXpForStage(bodyStageRef.current);
          if (newXp < required) break;
          newXp -= required;
          const newLevel = bodyStageRef.current + 1;
          setBodyStage(newLevel);
          bodyStageRef.current = newLevel;
          breakthroughs++;
        }
        // Single call — server cascades on its side
        if (breakthroughs > 0) {
          fetch("/api/game/breakthrough", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: "body_peak" }),
          }).catch(() => {});
        }
      }
      return newXp;
    });

    // Accumulate sync data
    const p = pendingRef.current;
    p.actions += 1;
    p.elapsed_ms += 3000;
    p.drops[droppedItem] = (p.drops[droppedItem] ?? 0) + qty;
    p.xp.mining += mine.xp_mining;
    p.xp.mastery += mine.xp_mastery;
    p.xp.body += mine.xp_body;

    // === SYSTEM 1: Dynamic notifications (only meaningful ones) ===
    if (!document.hidden) {
      const isZh = localeRef.current === "zh";
      const itemInfo = ITEM_NAMES[droppedItem];
      const itemName = itemInfo ? (isZh ? itemInfo.nameZh : itemInfo.nameEn) : droppedItem;
      // Always show drop
      addNotification(itemInfo?.icon ?? "○", itemName, qty, itemInfo?.color ?? "text-foreground", newTotal);
      // XP notifications
      addNotification("⛏️", isZh ? "挖礦經驗" : "Mining XP", mine.xp_mining, "text-blue-400");

      if (mine.xp_mastery > 0) {
      }
      if (bodyGainedXp && mine.xp_body > 0) {
        addNotification("💪", isZh ? "煉體經驗" : "Body Refining XP", mine.xp_body, "text-spirit-gold");
      }
      // Level-up notifications
      if (miningLeveledUp) {
        addNotification("🎉", isZh ? `挖礦升級 Lv.${miningLevelRef.current + 1}` : `Mining Up Lv.${miningLevelRef.current + 1}`, 1, "text-blue-400");
      }
      if (masteryLeveledUp) {
        addNotification("🎉", isZh ? `精通升級 Lv.${(masteryLevelsRef.current[mine.id] ?? 1) + 1}` : `Mastery Up Lv.${(masteryLevelsRef.current[mine.id] ?? 1) + 1}`, 1, "text-cinnabar");
      }
    }
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

      // If delta > 200ms, tab was in background (throttled).
      // Reset instead of processing accumulated time — prevents burst of actions.
      if (delta > 200) {
        accumulatedRef.current = 0;
        return;
      }

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

    // Apply mining XP with proper level-up calculation
    setMiningXp((prevXpInLevel) => {
      let totalXp = melvorXpForLevel(miningLevelRef.current) + prevXpInLevel + rewards.xp_gained.mining;
      let newLevel = miningLevelRef.current;
      while (newLevel < 99 && totalXp >= melvorXpForLevel(newLevel + 1)) {
        newLevel++;
      }
      const newXpInLevel = totalXp - melvorXpForLevel(newLevel);
      const newXpMax = melvorXpForLevel(newLevel + 1) - melvorXpForLevel(newLevel);
      setMiningLevel(newLevel);
      setMiningXpMax(newXpMax);
      return newXpInLevel;
    });

    // Apply mastery XP with level-up
    if (activeMineRef.current) {
      const mineId = activeMineRef.current.id;
      setMasteryXps((prev) => {
        const currentLevel = masteryLevelsRef.current[mineId] ?? 1;
        let totalXp = melvorXpForLevel(currentLevel) + (prev[mineId] ?? 0) + rewards.xp_gained.mastery;
        let newLevel = currentLevel;
        while (newLevel < 99 && totalXp >= melvorXpForLevel(newLevel + 1)) {
          newLevel++;
        }
        setMasteryLevels((ml) => ({ ...ml, [mineId]: newLevel }));
        setMasteryXpMaxs((mx) => ({ ...mx, [mineId]: melvorXpForLevel(newLevel + 1) - melvorXpForLevel(newLevel) }));
        return { ...prev, [mineId]: totalXp - melvorXpForLevel(newLevel) };
      });
    }

    // Apply body XP — auto-breakthrough at 巔峰 only if not in 煉體 anymore
    setBodyXp((prev) => {
      let newXp = prev + rewards.xp_gained.body;
      if (realmRef.current !== "煉體") {
        while (bodyStageRef.current >= 9) {
          const required = bodyXpForStage(bodyStageRef.current);
          if (newXp < required) break;
          newXp -= required;
          const newLevel = bodyStageRef.current + 1;
          setBodyStage(newLevel);
          bodyStageRef.current = newLevel;
        }
      }
      return newXp;
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

  // Visibility handler — flush pending on hide; on show, trigger unified offline reward check
  const syncMeditationRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        if (isMiningRef.current) syncToServer();
        if (isMeditatingRef.current) syncMeditationRef.current();
      } else if (hiddenAtRef.current) {
        hiddenAtRef.current = null;
        setNotifications([]);
        // Unified offline reward check — server decides based on last_sync_at
        fetch("/api/game/offline-rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (!data) return;
            const xp = data.xp_gained ?? {};
            const hasAnyGain = (xp.mining > 0) || (xp.qi > 0);
            if (!hasAnyGain) return;
            setPendingOfflineRewards({
              minutes_away: data.minutes_away,
              total_actions: 0,
              drops: Object.fromEntries((data.drops ?? []).map((d: { item_type: string; quantity: number }) => [d.item_type, d.quantity])),
              xp_gained: { mining: xp.mining ?? 0, mastery: xp.mastery ?? 0, body: xp.body ?? 0, qi: xp.qi },
              activity: data.session_type === "meditate" ? "冥想" : "挖礦",
            });
          })
          .catch(() => {});
        accumulatedRef.current = 0;
        lastTickRef.current = Date.now();
        meditationTickStartRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncToServer]);

  // Page load: check if returning from closed browser (only once)
  useEffect(() => {
    if (offlineCheckedRef.current) return;
    offlineCheckedRef.current = true;

    // Only skip if neither activity is active
    if (!initialStatus.isMining && !(initialState?.isMeditating)) return;

    // Call API immediately — offlineCheckedRef above already prevents duplicate calls within the same mount
    fetch("/api/game/offline-rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const xp = data.xp_gained ?? {};
        const hasAnyGain = (xp.mining ?? 0) > 0 || (xp.qi ?? 0) > 0 || (data.drops?.length ?? 0) > 0;
        if (hasAnyGain) {
          setPendingOfflineRewards({
            minutes_away: data.minutes_away,
            total_actions: 0,
            drops: Object.fromEntries((data.drops ?? []).map((d: { item_type: string; quantity: number }) => [d.item_type, d.quantity])),
            xp_gained: { mining: xp.mining ?? 0, mastery: xp.mastery ?? 0, body: xp.body ?? 0, qi: xp.qi },
            activity: data.session_type === "meditate" ? "冥想" : "挖礦",
          });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Meditation state (mutually exclusive with mining) ---
  const [isMeditating, setIsMeditating] = useState(initialState?.isMeditating ?? false);
  const [qiXp, setQiXp] = useState(initialState?.qiXp ?? 0);
  const [meditationProgress, setMeditationProgress] = useState(0);
  const qiArrayRef = useRef<(string | null)[]>(initialState?.qiArray ?? [null, null, null, null, null]);
  useEffect(() => {
    if (initialState?.qiArray) qiArrayRef.current = initialState.qiArray;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialState?.qiArray)]);
  const meditationPendingRef = useRef({ ticks: 0 });
  const meditationTickStartRef = useRef(0);
  const meditationRafRef = useRef<number | null>(null);
  const isMeditatingRef = useRef(isMeditating);
  isMeditatingRef.current = isMeditating;
  const localeForMedRef = useRef(locale);
  localeForMedRef.current = locale;

  const MEDITATION_TICK_MS = 10000;
  const MEDITATION_TICK_XP = 10;

  const syncMeditation = useCallback(async () => {
    const pending = meditationPendingRef.current;
    if (pending.ticks <= 0) return;
    const ticks = pending.ticks;
    meditationPendingRef.current = { ticks: 0 };
    try {
      await fetch("/api/game/meditate/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks }),
      });
    } catch {
      meditationPendingRef.current.ticks += ticks; // re-queue
    }
  }, []);
  syncMeditationRef.current = syncMeditation;

  // Meditation RAF tick loop — runs whenever isMeditating, regardless of which page user is on
  useEffect(() => {
    if (!isMeditating) {
      if (meditationRafRef.current) cancelAnimationFrame(meditationRafRef.current);
      setMeditationProgress(0);
      return;
    }
    meditationTickStartRef.current = Date.now();
    const loop = () => {
      const elapsed = Date.now() - meditationTickStartRef.current;
      const p = Math.min(elapsed / MEDITATION_TICK_MS, 1);
      setMeditationProgress(p);
      if (p >= 1) {
        // Consume one of each equipped spirit stone — decrement inventory optimistically
        const equippedStones = qiArrayRef.current.filter((it): it is string => !!it);
        if (equippedStones.length > 0) {
          setInventory((prev) => {
            const next = prev.map((inv) => {
              if (equippedStones.includes(inv.item_type)) {
                return { ...inv, quantity: Math.max(0, inv.quantity - 1) };
              }
              return inv;
            }).filter((inv) => inv.quantity > 0);
            return next;
          });
        }
        const bonus = qiArrayRef.current.reduce((sum, it) => sum + spiritStoneBonus(it), 0);
        const gained = MEDITATION_TICK_XP + bonus;
        setQiXp((x) => x + gained);
        meditationPendingRef.current.ticks += 1;
        const isZhNow = localeForMedRef.current === "zh";
        addNotification("🧘", isZhNow ? "靈氣" : "Qi XP", gained, "text-jade");
        meditationTickStartRef.current = Date.now();
      }
      meditationRafRef.current = requestAnimationFrame(loop);
    };
    meditationRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (meditationRafRef.current) cancelAnimationFrame(meditationRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMeditating]);

  // Batched meditation sync every 30s while meditating
  useEffect(() => {
    if (!isMeditating) {
      syncMeditation();
      return;
    }
    const timer = setInterval(syncMeditation, 30000);
    return () => clearInterval(timer);
  }, [isMeditating, syncMeditation]);

  // Heartbeat + flush on unload/hide
  useEffect(() => {
    // Immediate heartbeat on mount so last_seen_at reflects "now"
    fetch("/api/game/heartbeat", { method: "POST" }).catch(() => {});

    const flushAndBeacon = () => {
      const pending = meditationPendingRef.current;
      if (pending.ticks > 0) {
        navigator.sendBeacon(
          "/api/game/meditate/sync",
          JSON.stringify({ ticks: pending.ticks })
        );
        meditationPendingRef.current = { ticks: 0 };
      }
      navigator.sendBeacon("/api/game/heartbeat", "");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushAndBeacon();
    };

    window.addEventListener("beforeunload", flushAndBeacon);
    window.addEventListener("pagehide", flushAndBeacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flushAndBeacon);
      window.removeEventListener("pagehide", flushAndBeacon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Sync qiXp when initialState updates (e.g., after router.refresh)
  useEffect(() => {
    if (typeof initialState?.qiXp === "number") {
      setQiXp(initialState.qiXp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState?.qiXp]);

  // --- Actions ---
  const startMining = useCallback((mine: MineData) => {
    if (isMeditatingRef.current) syncMeditation();
    setIsMeditating(false);
    activeMineRef.current = mine;
    setActiveMineId(mine.id);
    setIsMining(true);
    accumulatedRef.current = 0;
    // Single unified call — server handles mutual exclusion via requested_at
    fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mining", mine_id: mine.id, requested_at: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  }, [syncMeditation]);

  const stopMining = useCallback(() => {
    syncToServer();
    setIsMining(false);
    setActiveMineId(null);
    activeMineRef.current = null;
    setActionProgress(0);
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [syncToServer]);

  const startMeditation = useCallback(() => {
    if (isMiningRef.current) {
      syncToServer();
      setIsMining(false);
      setActiveMineId(null);
      activeMineRef.current = null;
      setActionProgress(0);
    }
    setIsMeditating(true);
    fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meditate", requested_at: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  }, [syncToServer]);

  const stopMeditation = useCallback(() => {
    syncMeditation();
    setIsMeditating(false);
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [syncMeditation]);

  // --- Combat state (provider-level, survives page navigation) ---
  const [isCombating, setIsCombating] = useState(false);
  const [combatMonster, setCombatMonster] = useState<Monster | null>(null);
  const [playerHp, setPlayerHp] = useState(0);
  const [monsterHp, setMonsterHp] = useState(0);
  const [combatPlayerProgress, setCombatPlayerProgress] = useState(0);
  const [combatMonsterProgress, setCombatMonsterProgress] = useState(0);
  const [combatKillCount, setCombatKillCount] = useState(0);
  const [combatLogs, setCombatLogs] = useState<{ id: number; text: string; color: string }[]>([]);
  const [combatLootSlots, setCombatLootSlots] = useState<{ item_type: string; quantity: number }[]>(initialState?.lootBox ?? []);

  const combatMonsterRef = useRef<Monster | null>(null);
  const playerHpRef2 = useRef(0);
  const monsterHpRef2 = useRef(0);
  const combatPlayerTickRef = useRef(0);
  const combatMonsterTickRef = useRef(0);
  const combatRafRef = useRef<number | null>(null);
  const combatLogIdRef = useRef(0);
  const combatPendingRef = useRef({ kills: 0, body_xp: 0 });
  const combatLootRef = useRef<{ item_type: string; quantity: number }[]>(initialState?.lootBox ?? []);
  const isCombatingRef = useRef(false);
  isCombatingRef.current = isCombating;

  const COMBAT_ATTACK_MS = PLAYER_ATTACK_INTERVAL * 1000;

  const addCombatLog = useCallback((text: string, color: string) => {
    const id = ++combatLogIdRef.current;
    setCombatLogs((prev) => [...prev.slice(-8), { id, text, color }]);
  }, []);

  const saveCombatLoot = useCallback((slots: { item_type: string; quantity: number }[]) => {
    combatLootRef.current = slots;
    fetch("/api/game/loot-box", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loot_box: slots }),
    }).catch(() => {});
  }, []);

  const syncCombat = useCallback(() => {
    const p = combatPendingRef.current;
    if (p.kills <= 0 && p.body_xp <= 0) return;
    const toSync = { ...p };
    combatPendingRef.current = { kills: 0, body_xp: 0 };
    fetch("/api/game/combat/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kills: toSync.kills, body_xp: toSync.body_xp, loot_box: combatLootRef.current, player_died: false }),
    }).catch(() => {
      combatPendingRef.current.kills += toSync.kills;
      combatPendingRef.current.body_xp += toSync.body_xp;
    });
  }, []);

  // Combat RAF loop
  useEffect(() => {
    if (!isCombating || !combatMonsterRef.current) {
      if (combatRafRef.current) cancelAnimationFrame(combatRafRef.current);
      setCombatPlayerProgress(0);
      setCombatMonsterProgress(0);
      return;
    }
    combatPlayerTickRef.current = Date.now();
    combatMonsterTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const monster = combatMonsterRef.current!;
      const round = calcCombatRound(
        computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: initialState?.equipment ?? {} }),
        monster
      );
      const isZhNow = localeForMedRef.current === "zh";

      const pElapsed = now - combatPlayerTickRef.current;
      setCombatPlayerProgress(Math.min(pElapsed / COMBAT_ATTACK_MS, 1));

      const mElapsed = now - combatMonsterTickRef.current;
      setCombatMonsterProgress(Math.min(mElapsed / (monster.attackSpeed * 1000), 1));

      // Player attacks
      if (pElapsed >= COMBAT_ATTACK_MS) {
        monsterHpRef2.current = Math.max(0, monsterHpRef2.current - round.playerDmg);
        setMonsterHp(monsterHpRef2.current);
        addCombatLog(
          isZhNow ? `你對${monster.nameZh}造成 ${round.playerDmg} 點傷害` : `You deal ${round.playerDmg} to ${monster.nameEn}`,
          "text-spirit-gold"
        );
        combatPlayerTickRef.current = now;

        if (monsterHpRef2.current <= 0) {
          addCombatLog(isZhNow ? `${monster.nameZh}被擊敗！` : `${monster.nameEn} defeated!`, "text-jade");
          setCombatKillCount((c) => c + 1);
          addNotification(monster.icon, isZhNow ? `${monster.nameZh} 擊敗` : `${monster.nameEn} defeated`, 1, "text-cinnabar");

          // Drops → loot box (per-kill slots)
          setCombatLootSlots((prev) => {
            const next = [...prev];
            const killSlots: { item_type: string; quantity: number }[] = [];
            for (const drop of monster.drops) {
              const isEquip = hasTag(drop.item_type, "equipment");
              for (let i = 0; i < drop.quantity; i++) {
                if (next.length + killSlots.length >= 100) break;
                if (isEquip) {
                  killSlots.push({ item_type: drop.item_type, quantity: 1 });
                } else {
                  const existing = killSlots.find((s) => s.item_type === drop.item_type);
                  if (existing) existing.quantity += 1;
                  else killSlots.push({ item_type: drop.item_type, quantity: 1 });
                }
              }
              const meta = ITEMS[drop.item_type];
              if (meta) addNotification(meta.icon, isZhNow ? meta.nameZh : meta.nameEn, drop.quantity, meta.color);
            }
            next.push(...killSlots);
            saveCombatLoot(next);
            return next;
          });

          if (monster.bodyXp > 0) {
            addNotification("💪", isZhNow ? "煉體經驗" : "Body XP", monster.bodyXp, "text-spirit-gold");
          }
          combatPendingRef.current.kills += 1;
          combatPendingRef.current.body_xp += monster.bodyXp;

          // Respawn
          monsterHpRef2.current = monster.hp;
          setMonsterHp(monster.hp);
          combatPlayerTickRef.current = now;
          combatMonsterTickRef.current = now;
        }
      }

      // Monster attacks
      if (mElapsed >= monster.attackSpeed * 1000) {
        playerHpRef2.current = Math.max(0, playerHpRef2.current - round.monsterDmg);
        setPlayerHp(playerHpRef2.current);
        addCombatLog(
          isZhNow ? `${monster.nameZh}對你造成 ${round.monsterDmg} 點傷害` : `${monster.nameEn} deals ${round.monsterDmg} to you`,
          "text-cinnabar"
        );
        combatMonsterTickRef.current = now;

        if (playerHpRef2.current <= 0) {
          addCombatLog(isZhNow ? "你被擊敗了！" : "You were defeated!", "text-cinnabar");
          setIsCombating(false);
          combatMonsterRef.current = null;
          syncCombat();
          fetch("/api/game/stop-activity", { method: "POST", keepalive: true }).catch(() => {});
          return;
        }
      }

      combatRafRef.current = requestAnimationFrame(loop);
    };
    combatRafRef.current = requestAnimationFrame(loop);
    return () => { if (combatRafRef.current) cancelAnimationFrame(combatRafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCombating]);

  // Combat sync every 30s
  useEffect(() => {
    if (!isCombating) { syncCombat(); return; }
    const timer = setInterval(syncCombat, 30000);
    return () => { syncCombat(); clearInterval(timer); };
  }, [isCombating, syncCombat]);

  // Combat beforeunload
  useEffect(() => {
    const handler = () => {
      if (!isCombatingRef.current) return;
      const p = combatPendingRef.current;
      if (p.kills > 0 || p.body_xp > 0) {
        navigator.sendBeacon("/api/game/combat/sync", JSON.stringify({
          kills: p.kills, body_xp: p.body_xp, loot_box: combatLootRef.current, player_died: false,
        }));
      }
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  // Resume combat from active session on mount
  useEffect(() => {
    if (initialState?.lootBox && initialState.lootBox.length > 0) {
      setCombatLootSlots(initialState.lootBox);
      combatLootRef.current = initialState.lootBox;
    }
    // Check for active combat session
    fetch("/api/game/profile-data")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.active_session?.type === "combat" && d.active_session.payload?.monster_id) {
          const monsterId = d.active_session.payload.monster_id;
          for (const zone of COMBAT_ZONES) {
            const monster = zone.monsters.find((m) => m.id === monsterId);
            if (monster) {
              const stats = computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: initialState?.equipment ?? {} });
              setCombatMonster(monster);
              combatMonsterRef.current = monster;
              monsterHpRef2.current = monster.hp;
              playerHpRef2.current = stats.hp;
              setMonsterHp(monster.hp);
              setPlayerHp(stats.hp);
              setIsCombating(true);
              break;
            }
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCombat = useCallback((monster: Monster) => {
    // Stop other activities
    if (isMiningRef.current) { syncToServer(); setIsMining(false); setActiveMineId(null); activeMineRef.current = null; setActionProgress(0); }
    if (isMeditatingRef.current) { syncMeditation(); setIsMeditating(false); }

    const stats = computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: initialState?.equipment ?? {} });
    setCombatMonster(monster);
    combatMonsterRef.current = monster;
    monsterHpRef2.current = monster.hp;
    playerHpRef2.current = stats.hp;
    setMonsterHp(monster.hp);
    setPlayerHp(stats.hp);
    setCombatLogs([]);
    setCombatKillCount(0);
    setIsCombating(true);

    fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "combat", requested_at: Date.now(), target: { monster_id: monster.id } }),
      keepalive: true,
    }).catch(() => {});
  }, [syncToServer, syncMeditation, initialState]);

  const stopCombat = useCallback(() => {
    syncCombat();
    setIsCombating(false);
    combatMonsterRef.current = null;
    setCombatMonster(null);
    fetch("/api/game/stop-activity", { method: "POST", keepalive: true }).catch(() => {});
  }, [syncCombat]);

  const collectCombatLoot = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (combatLootRef.current.length === 0) return { ok: true };
    const aggregated: Record<string, number> = {};
    for (const slot of combatLootRef.current) {
      aggregated[slot.item_type] = (aggregated[slot.item_type] ?? 0) + slot.quantity;
    }
    try {
      const res = await fetch("/api/game/collect-loot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: aggregated }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Failed" };
      setCombatLootSlots([]);
      saveCombatLoot([]);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [saveCombatLoot]);

  // --- Context value ---
  const value: GameContextValue = {
    isMining, activeMineId, actionProgress,
    miningLevel, miningXp, miningXpMax,
    masteryLevels, masteryXps, masteryXpMaxs,
    bodyStage, bodyXp, realm, inventory,
    notifications, pendingOfflineRewards,
    isMeditating, qiXp, meditationProgress,
    equipment: initialState?.equipment ?? {},
    equipmentSets: initialState?.equipmentSets ?? { "1": {}, "2": {} },
    activeEquipmentSet: initialState?.activeEquipmentSet ?? 1,
    bodyLevel: initialState?.bodyLevel ?? 1,
    lootBox: initialState?.lootBox ?? [],
    isCombating, combatMonster, playerHp, playerMaxHp: computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: initialState?.equipment ?? {} }).hp,
    monsterHp, combatPlayerProgress, combatMonsterProgress, combatKillCount, combatLogs, combatLootSlots,
    startMining, stopMining, startMeditation, stopMeditation,
    startCombat, stopCombat, collectCombatLoot,
    updateQiArray: (next: (string | null)[]) => { qiArrayRef.current = next; },
    addNotification,
    dismissOfflineRewards,
    updateInventory: setInventory,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
