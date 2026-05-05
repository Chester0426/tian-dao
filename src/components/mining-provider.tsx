"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { melvorXpForLevel, miningXpForLevel, totalMiningXpForLevel } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { COMBAT_ZONES, type Monster } from "@/lib/combat";
import { PLAYER_ATTACK_INTERVAL } from "@/lib/combat-sim";
import { ITEMS, hasTag, getItem } from "@/lib/items";
import { computeStats } from "@/lib/stats";
import type { InventoryItem } from "@/lib/types";
import type { OfflineRewardResult } from "@/lib/offline-rewards";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Item display names (for notifications)
// ---------------------------------------------------------------------------

// Use central ITEMS registry for names, icons, images, and colors
import { ITEMS as ITEM_NAMES } from "@/lib/items";

interface CompanionDrop { item: string; chance: number }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MineData {
  id: string;
  slug: string;
  xp_mining: number;
  xp_mastery: number;
  xp_body: number;
  main_drop: string;
  companion_drops: CompanionDrop[];
  rock_base_hp: number;
  respawn_seconds: number;
}

export interface Notification {
  id: number;
  icon: string;
  image?: string;
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
  combat?: { kills: number; died: boolean; monster_id?: string };
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
  rockHp: number;
  rockMaxHp: number;
  respawnProgress: number;
  rockHpMap: Record<string, number>;
  rockLastActiveMap: Record<string, number>;
  rockDepletedAtMap: Record<string, number | null>;
  bodyStage: number;
  bodyXp: number;
  realm: string;
  inventory: InventoryItem[];
  notifications: Notification[];
  pendingOfflineRewards: PendingOfflineRewards | null;
  offlineLoading: boolean;
  isMeditating: boolean;
  qiXp: number;
  meditationProgress: number;
  equipment: Record<string, string>;
  equipmentSets: Record<string, Record<string, string>>;
  activeEquipmentSet: number;
  bodyLevel: number;
  lootBox: { item_type: string; quantity: number }[];
  // Consumables
  consumableSlots: (string | null)[]; // 3 slots, item_type or null
  activeConsumableIdx: number; // which slot is currently selected (0-2)
  // Enlightenment
  isEnlightening: boolean;
  // Combat
  isCombating: boolean;
  combatMonster: Monster | null;
  playerHp: number;
  playerMaxHp: number;
  playerAtk: number;
  playerDef: number;
  monsterHp: number;
  combatPlayerProgress: number;
  combatMonsterProgress: number;
  combatKillCount: number;
  combatLogs: { id: number; text: string; color: string }[];
  combatLootSlots: { item_type: string; quantity: number }[];
  furnaceHeat: number;
  // Smithing
  isSmithing: boolean;
  smithingRecipeId: string | null;
  smithingLevel: number;
  smithingXp: number;
  craftCount: number;
  craftProgress: number;
  lastSyncAt: number; // timestamp of last successful sync
}

export interface ActivitySwitchConfirm {
  from: string; // current activity name
  to: string; // target activity name
  onConfirm: () => void;
}

interface GameContextValue extends GameState {
  activitySwitchConfirm: ActivitySwitchConfirm | null;
  dismissActivitySwitch: () => void;
  setDontAskActivitySwitch: (v: boolean) => void;
  startMining: (mine: MineData) => void;
  stopMining: () => void;
  startMeditation: () => void;
  stopMeditation: () => void;
  startCombat: (monster: Monster) => void;
  stopCombat: () => void;
  startSmithing: (recipeId: string, targetCount?: number) => void;
  stopSmithing: () => void;
  collectCombatLoot: () => Promise<{ ok: boolean; error?: string }>;
  setConsumableSlot: (idx: number, itemType: string | null) => void;
  setActiveConsumableIdx: (idx: number) => void;
  consumeItem: () => void;
  updateQiArray: (next: (string | null)[]) => void;
  addNotification: (icon: string, label: string, amount: number, color: string, total?: number, image?: string) => void;
  dismissOfflineRewards: () => void;
  updateInventory: (updater: (prev: InventoryItem[]) => InventoryItem[]) => void;
  updateEquipmentSet: (setNum: number, sets: Record<string, Record<string, string>>) => void;
  setEnlightening: (v: boolean) => void;
  registerEnlightenmentSync: (fn: () => void) => void;
  setFurnaceHeat: (heat: number) => void;
  flushAllPending: () => void;
  requestActivitySwitch: (targetName: string, onConfirm: () => void) => void;
  hasEntered: boolean;
  setHasEntered: (v: boolean) => void;
  applyBreakthrough: (data: { realm: string; new_level: number; leftover_xp: number }) => void;
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
      ctx.startMining({ id: mineId, slug: "coal_mine", xp_mining: 5, xp_mastery: 3, xp_body: 5, main_drop: "coal", companion_drops: [], rock_base_hp: 1, respawn_seconds: 5 });
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
  slot?: number;
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
    combatMonsterId?: string | null;
    qiArray?: (string | null)[];
    consumableSlots?: (string | null)[];
    furnaceHeat?: number;
    isSmithing?: boolean;
    smithingRecipeId?: string | null;
    smithingLevel?: number;
    smithingXp?: number;
    userPreferences?: Record<string, unknown>;
    offlineRewards?: {
      minutes_away: number;
      session_type: "mining" | "meditate";
      drops: { item_type: string; quantity: number }[];
      xp_gained: { mining: number; mastery: number; body: number; qi?: number };
    } | null;
  };
}

export function MiningProvider({ children, slot: slotProp, initialStatus, initialState }: ProviderProps) {
  const initialMine = initialState?.activeMine && initialStatus.isMining ? initialState.activeMine : null;

  // Supabase client for RPC calls (auth.uid() is used server-side, no need for userIdRef)
  const supabaseRef = useRef(createClient());
  const slotRef = useRef(slotProp ?? 1);

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

  // --- Furnace heat (smithing) ---
  const [furnaceHeat, setFurnaceHeat] = useState(initialState?.furnaceHeat ?? 0);

  // --- Loading screen gate ---
  const [hasEntered, setHasEntered] = useState(false);

  // --- Sync tracking ---
  const [lastSyncAt, setLastSyncAt] = useState(0);

  // --- Offline rewards (system 2) ---
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [pendingOfflineRewards, setPendingOfflineRewards] = useState<PendingOfflineRewards | null>(() => {
    const init = initialState?.offlineRewards as OfflineRewardResult | null | undefined;
    if (!init) return null;
    return {
      minutes_away: init.minutes_away,
      total_actions: 0,
      drops: Object.fromEntries(init.drops.map((d) => [d.item_type, d.quantity])),
      xp_gained: { mining: init.xp_gained.mining ?? 0, mastery: init.xp_gained.mastery ?? 0, body: init.xp_gained.body ?? 0, qi: init.xp_gained.qi },
      activity: init.session_type === "combat" ? "遊歷" : init.session_type === "meditate" ? "冥想" : "挖礦",
      combat: init.combat,
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

  // --- Rock HP system (per-mine) ---
  const initialRockHpMap = (initialState as { rockHpMap?: Record<string, number> })?.rockHpMap ?? {};
  const initialRockLastActiveMap = (initialState as { rockLastActiveMap?: Record<string, string> })?.rockLastActiveMap ?? {};
  const initialRockDepletedAtMap = (initialState as { rockDepletedAtMap?: Record<string, string | null> })?.rockDepletedAtMap ?? {};
  const [rockHpMap, setRockHpMap] = useState<Record<string, number>>(initialRockHpMap);
  const [rockLastActiveMap, setRockLastActiveMap] = useState<Record<string, number>>(
    Object.fromEntries(Object.entries(initialRockLastActiveMap).map(([k, v]) => [k, new Date(v as string).getTime()]))
  );
  const [rockDepletedAtMap, setRockDepletedAtMap] = useState<Record<string, number | null>>(
    Object.fromEntries(Object.entries(initialRockDepletedAtMap).map(([k, v]) => [k, v ? new Date(v as string).getTime() : null]))
  );
  const rockDepletedAtMapRef = useRef<Record<string, number | null>>(rockDepletedAtMap);
  rockDepletedAtMapRef.current = rockDepletedAtMap;
  // Tick state — increments via RAF for smooth HP/respawn animation in UI (60fps)
  const [, setRegenTick] = useState(0);
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      setRegenTick((n) => n + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);
  const [rockHp, setRockHp] = useState(1);
  const [rockMaxHp, setRockMaxHp] = useState(1);
  const [respawnProgress, setRespawnProgress] = useState(0);
  const rockHpRef = useRef(1);
  const rockHpMapRef = useRef<Record<string, number>>(initialRockHpMap);
  const respawningRef = useRef(false);
  const respawnAccRef = useRef(0);

  // Server timing refs (filled by RPC response)
  const serverLastTickAtRef = useRef<number | null>(null);
  const serverTickIntervalMsRef = useRef<number>(3000);

  // Tracks when we last fired a respawn confirmation RPC for each mine.
  // Used to throttle retries when server says "still respawning" (rare boundary case).
  const respawnConfirmFiredRef = useRef<Record<string, number>>({});

  // Helper: update rockHp + persist to per-mine map
  const updateRockHp = useCallback((mineId: string, hp: number) => {
    rockHpRef.current = hp;
    setRockHp(hp);
    rockHpMapRef.current = { ...rockHpMapRef.current, [mineId]: hp };
    setRockHpMap(rockHpMapRef.current);
  }, []);

  // Mining sync is handled per-action via supabase.rpc("mine_action") — no batch sync needed

  // --- Idle regen polling ---
  // Every 10s, ask server to apply +1 HP per 10s to all non-mining, non-respawning mines.
  // Server enforces the rate via FLOOR((now - last_active_at) / 10) — client can't cheat.
  // Server-authoritative: HP value displayed = whatever server returns, no client formula.
  useEffect(() => {
    const tick = () => {
      const supabase = supabaseRef.current;
      const slot = slotRef.current;
      if (!supabase || !slot) return;
      supabase.rpc("mine_regen_tick", { p_slot: slot })
        .then(({ data, error }: { data: unknown; error: unknown }) => {
          if (error || !data) return;
          const result = data as {
            error?: string;
            rocks?: { mine_id: string; current_hp: number; depleted_at: string | null; last_active_at: string }[];
          };
          if (result.error || !result.rocks || result.rocks.length === 0) return;
          // Update local rockHpMap with server's authoritative values
          const newHpMap = { ...rockHpMapRef.current };
          for (const rock of result.rocks) {
            newHpMap[rock.mine_id] = rock.current_hp;
          }
          rockHpMapRef.current = newHpMap;
          setRockHpMap(newHpMap);
          // Update lastActiveMap (used for display alignment, not regen calc anymore)
          setRockLastActiveMap((prev) => {
            const next = { ...prev };
            for (const rock of result.rocks!) {
              next[rock.mine_id] = new Date(rock.last_active_at).getTime();
            }
            return next;
          });
        })
        .catch(() => { /* network error — skip this tick */ });
    };
    tick(); // Run once at mount
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body 巔峰 cascade is handled server-side by a BEFORE UPDATE trigger on
  // profiles.body_xp. mine_action returns the post-cascade body_level + body_xp,
  // and SSR initialState carries the same. No client-side catch-up needed.

  // --- Clean old notifications ---
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => Date.now() - n.timestamp < 2500));
    }, 2600);
    return () => clearTimeout(timer);
  }, [notifications]);

  // --- Add notification helper ---
  const addNotification = useCallback((icon: string, label: string, amount: number, color: string, total?: number, image?: string) => {
    const id = ++notifIdRef.current * 1000 + Math.floor(Math.random() * 1000);
    const timestamp = Date.now();
    setNotifications((prev) => [...prev.slice(-10), { id, icon, image, label, amount, total, color, timestamp }]);
  }, []);

  // --- Mine action (server-authoritative: all data from RPC) ---
  const doLocalMineAction = useCallback(() => {
    const mine = activeMineRef.current;
    if (!mine) return;

    supabaseRef.current.rpc("mine_action", {
      p_slot: slotRef.current,
      p_mine_id: mine.id,
    }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error || !data) return;
      const result = data as {
        error?: string;
        ticks_processed: number;
        drops: { item: string; qty: number }[];
        xp: { mining: number; mastery: number; body: number };
        mining_level: number; mining_xp: number;
        mastery_level: number; mastery_xp: number;
        body_xp: number;
        body_level: number;
        body_breakthroughs: number;
        leveled_up_mining: boolean; leveled_up_mastery: boolean;
        rock_hp: number; rock_max_hp: number;
        depleted_at: string | null;
        last_tick_at: string;
        next_tick_in_ms: number;
        tick_interval_ms: number;
      };

      if (result.error) return;
      if (!isMiningRef.current) return;

      // Sync server timing for progress bar
      if (result.last_tick_at) {
        serverLastTickAtRef.current = new Date(result.last_tick_at).getTime();
      }
      if (typeof result.tick_interval_ms === "number") {
        serverTickIntervalMsRef.current = result.tick_interval_ms;
      }

      // Update last_active_at to now (server just processed this rock)
      setRockLastActiveMap((m) => ({ ...m, [mine.id]: Date.now() }));

      // depleted_at handling: use CLIENT time as animation anchor (not server time)
      const serverDepleted = result.depleted_at;
      const prevClientDepleted = rockDepletedAtMapRef.current[mine.id] ?? null;
      // Did we just optimistically clear (RAF respawn complete)?
      // If yes, ignore "still respawning" responses to prevent animation restart.
      const justOptimisticCleared = (respawnConfirmFiredRef.current[mine.id] || 0) > 0
        && prevClientDepleted === null;

      let newDepletedAt: number | null;
      if (!serverDepleted) {
        newDepletedAt = null;
        // Server confirmed → reset retry flag
        if (respawnConfirmFiredRef.current[mine.id]) {
          respawnConfirmFiredRef.current[mine.id] = 0;
        }
      } else if (justOptimisticCleared) {
        // We optimistically cleared after respawn animation, but server still
        // thinks "still respawning" (network jitter). Keep cleared — next mining
        // tick will confirm. Don't restart animation.
        newDepletedAt = null;
      } else if (prevClientDepleted) {
        // Already had a client-anchored value, keep it (don't reset animation)
        newDepletedAt = prevClientDepleted;
      } else {
        // Fresh depletion — anchor to client time
        newDepletedAt = Date.now();
      }
      setRockDepletedAtMap((m) => ({ ...m, [mine.id]: newDepletedAt }));
      rockDepletedAtMapRef.current = { ...rockDepletedAtMapRef.current, [mine.id]: newDepletedAt };

      // Update rock HP from server
      if (typeof result.rock_hp === 'number') {
        // Don't overwrite optimistic max with server's stale 0 if we just cleared
        // (server may briefly return HP=0 + depleted=set during "still respawning")
        const skipHpOverwrite = justOptimisticCleared && result.rock_hp === 0;
        if (!skipHpOverwrite) {
          const newMap = { ...rockHpMapRef.current, [mine.id]: result.rock_hp };
          rockHpMapRef.current = newMap;
          setRockHpMap(newMap);
          rockHpRef.current = result.rock_hp;
          setRockHp(result.rock_hp);
          if (typeof result.rock_max_hp === 'number') {
            setRockMaxHp(result.rock_max_hp);
          }
        }
      }

      // 0 ticks processed (just a state sync) — skip notifications/inventory/XP updates
      if (result.ticks_processed === 0) {
        return;
      }

      // Track old levels for notifications
      const oldMiningLevel = miningLevelRef.current;
      const oldMasteryLevel = masteryLevelsRef.current[mine.id] ?? 1;

      // Update inventory from server drops — compute synchronously from ref
      let updated = [...inventoryRef.current];
      const dropTotals: Record<string, number> = {};
      for (const drop of result.drops) {
        const idx = updated.findIndex((i) => i.item_type === drop.item);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + drop.qty };
        } else {
          updated = [...updated, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: drop.item, quantity: drop.qty, created_at: "" }];
        }
        dropTotals[drop.item] = updated.find((i) => i.item_type === drop.item)!.quantity;
      }
      inventoryRef.current = updated;
      setInventory(updated);

      // Update mining XP/level from server
      setMiningLevel(result.mining_level);
      miningLevelRef.current = result.mining_level;
      setMiningXpMax(miningXpForLevel(result.mining_level));
      miningXpMaxRef.current = miningXpForLevel(result.mining_level);
      setMiningXp(result.mining_xp - totalMiningXpForLevel(result.mining_level));

      // Update mastery XP/level from server
      setMasteryLevels((ml) => ({ ...ml, [mine.id]: result.mastery_level }));
      masteryLevelsRef.current = { ...masteryLevelsRef.current, [mine.id]: result.mastery_level };
      setMasteryXpMaxs((mx) => ({ ...mx, [mine.id]: melvorXpForLevel(result.mastery_level + 1) - melvorXpForLevel(result.mastery_level) }));
      setMasteryXps((prev) => ({ ...prev, [mine.id]: result.mastery_xp - melvorXpForLevel(result.mastery_level) }));

      // Body XP/level — server-authoritative; trigger handles cascade.
      // Just mirror server's post-trigger values, and notify if any breakthrough fired.
      if (typeof result.body_level === "number" && result.body_level !== bodyStageRef.current) {
        setBodyStage(result.body_level);
        bodyStageRef.current = result.body_level;
      }
      setBodyXp(result.body_xp);
      if (result.body_breakthroughs && result.body_breakthroughs > 0 && !document.hidden) {
        const isZh = localeRef.current === "zh";
        for (let i = 0; i < result.body_breakthroughs; i++) {
          const lvl = (bodyStageRef.current - result.body_breakthroughs + 1 + i);
          addNotification("⚡", isZh ? `巔峰 +${lvl - 8}` : `Peak +${lvl - 8}`, 1, "text-spirit-gold");
        }
      }

      // Offline catch-up notification: if we processed many ticks at once (e.g., player came back),
      // pop a dialog summarizing what they got while away.
      const OFFLINE_THRESHOLD = 5;
      if (result.ticks_processed >= OFFLINE_THRESHOLD) {
        const offlineSeconds = result.ticks_processed * (result.tick_interval_ms / 1000);
        const dropsObj: Record<string, number> = {};
        for (const d of result.drops) dropsObj[d.item] = d.qty;
        setPendingOfflineRewards({
          minutes_away: Math.floor(offlineSeconds / 60),
          total_actions: result.ticks_processed,
          drops: dropsObj,
          xp_gained: { mining: result.xp.mining, mastery: result.xp.mastery, body: result.xp.body },
          activity: "挖礦",
        });
      }

      // Notifications — only show when foreground.
      // For batch ticks (offline catch-up), still show aggregated result.
      if (!document.hidden) {
        const isZh = localeRef.current === "zh";
        for (const drop of result.drops) {
          const info = ITEM_NAMES[drop.item];
          const total = dropTotals[drop.item] ?? drop.qty;
          addNotification(info?.icon ?? "○", info ? (isZh ? info.nameZh : info.nameEn) : drop.item, drop.qty, info?.color ?? "text-foreground", total, info?.image);
        }
        if (result.xp.mining > 0) {
          addNotification("⛏️", isZh ? "挖礦經驗" : "Mining XP", result.xp.mining, "text-blue-400");
        }
        if (result.xp.body > 0) {
          addNotification("💪", isZh ? "煉體經驗" : "Body Refining XP", result.xp.body, "text-spirit-gold");
        }
        if (result.mining_level > oldMiningLevel) {
          addNotification("🎉", isZh ? `挖礦升級 Lv.${result.mining_level}` : `Mining Up Lv.${result.mining_level}`, 1, "text-blue-400");
        }
        if (result.mastery_level > oldMasteryLevel) {
          addNotification("🎉", isZh ? `精通升級 Lv.${result.mastery_level}` : `Mastery Up Lv.${result.mastery_level}`, 1, "text-cinnabar");
        }
      }

      setLastSyncAt(Date.now());
    }).catch(() => { /* network error — skip this tick */ });
  }, [addNotification]);

  // Rock HP regen is handled server-side in mine_action (respawn after depleted_at + respawn_seconds)

  // --- Mining tick ---
  // Frontend owns the animation: smooth client-side timer.
  // When progress hits 100%, fire RPC (fire-and-forget) and reset to 0.
  // RPC response updates inventory/XP/notifications asynchronously, doesn't affect animation.
  // Server still owns the truth (last_tick_at), this is just visual.
  const miningRafRef = useRef<number | null>(null);
  const tickStartRef = useRef(0);
  useEffect(() => {
    if (!isMining) {
      if (miningRafRef.current) { cancelAnimationFrame(miningRafRef.current); miningRafRef.current = null; }
      setActionProgress(0);
      return;
    }

    // Get tick interval from server (one initial sync)
    doLocalMineAction();
    tickStartRef.current = Date.now();

    const loop = () => {
      if (!isMiningRef.current) return;
      const mine = activeMineRef.current;
      if (!mine) return;

      // Check if rock is in respawn phase (depleted_at set on active mine)
      const depletedAt = rockDepletedAtMapRef.current[mine.id];
      if (depletedAt) {
        // Respawn animation: progress from depleted_at over respawn_seconds
        const respawnMs = mine.respawn_seconds * 1000;
        const respawnElapsed = Date.now() - depletedAt;
        const respawnPct = Math.min((respawnElapsed / respawnMs) * 100, 100);
        setRespawnProgress(respawnPct);
        setActionProgress(0);
        // Optimistic UI: animation reaches 100% → instantly switch to mining mode.
        // Set respawnConfirmFiredRef so handler knows we just cleared (and ignores
        // any "still respawning" response that arrives due to network jitter).
        if (respawnElapsed >= respawnMs) {
          const masteryLvl = masteryLevelsRef.current[mine.id] ?? 1;
          const maxHp = mine.rock_base_hp + masteryLvl;
          rockDepletedAtMapRef.current = { ...rockDepletedAtMapRef.current, [mine.id]: null };
          setRockDepletedAtMap((m) => ({ ...m, [mine.id]: null }));
          rockHpMapRef.current = { ...rockHpMapRef.current, [mine.id]: maxHp };
          setRockHpMap(rockHpMapRef.current);
          rockHpRef.current = maxHp;
          setRockHp(maxHp);
          setRockMaxHp(maxHp);
          setRespawnProgress(0);
          tickStartRef.current = Date.now();
          respawnConfirmFiredRef.current[mine.id] = Date.now();
          doLocalMineAction();
        }
        miningRafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Normal mining animation
      setRespawnProgress(0);
      const interval = serverTickIntervalMsRef.current || 3000;
      const elapsed = Date.now() - tickStartRef.current;
      if (elapsed >= interval) {
        // Cycle complete — fire RPC, reset animation immediately
        tickStartRef.current = Date.now();
        setActionProgress(0);
        doLocalMineAction();
      } else {
        setActionProgress((elapsed / interval) * 100);
      }
      miningRafRef.current = requestAnimationFrame(loop);
    };
    miningRafRef.current = requestAnimationFrame(loop);

    return () => { if (miningRafRef.current) cancelAnimationFrame(miningRafRef.current); };
  }, [isMining, activeMineId, doLocalMineAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // === SYSTEM 2: Unified offline rewards (visibility + page load) ===
  const hiddenAtRef = useRef<number | null>(null);
  const offlineCheckedRef = useRef(false);

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
      let totalXp = totalMiningXpForLevel(miningLevelRef.current) + prevXpInLevel + rewards.xp_gained.mining;
      let newLevel = miningLevelRef.current;
      while (newLevel < 500 && totalXp >= totalMiningXpForLevel(newLevel + 1)) {
        newLevel++;
      }
      const newXpInLevel = totalXp - totalMiningXpForLevel(newLevel);
      const newXpMax = miningXpForLevel(newLevel);
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

    // Apply body XP — server has already cascaded巔峰 levels via trigger when
    // offline rewards were computed on the backend. Local state mirrors the
    // delta; next mine_action response will reconcile any brief desync.
    setBodyXp((prev) => prev + rewards.xp_gained.body);

    setPendingOfflineRewards(null);
    // Mining continues — offline rewards already applied server-side
  }, [pendingOfflineRewards]);

  // Visibility handler — flush pending on hide; on show, trigger unified offline reward check
  const syncMeditationRef = useRef<() => void>(() => {});
  const syncCombatRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        // Mining is per-action RPC — no flush needed
        if (isMeditatingRef.current) syncMeditationRef.current();
        if (isCombatingRef.current) syncCombatRef.current();
        // Always update heartbeat so last_sync_at is accurate for offline reward calculation
        navigator.sendBeacon("/api/game/heartbeat", "");
      } else if (hiddenAtRef.current) {
        const awayMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        setNotifications([]);
        // Skip offline check if away less than 60 seconds
        if (awayMs < 60_000) {
          accumulatedRef.current = 0;
          lastTickRef.current = Date.now();
          meditationTickStartRef.current = Date.now();
          // combat_tick will resync naturally on next call
          return;
        }
        // Unified offline reward check — server decides based on last_sync_at
        setOfflineLoading(true);
        fetch("/api/game/offline-rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            setOfflineLoading(false);
            if (!data) return;
            const xp = data.xp_gained ?? {};
            const hasAnyGain = (xp.mining > 0) || (xp.qi > 0) || (xp.body > 0) || (data.combat?.kills > 0) || (data.combat?.died) || (data.drops?.length > 0);
            if (!hasAnyGain) return;
            // If combat resulted in death, stop the RAF loop
            if (data.combat?.died) {
              setIsCombating(false);
              setCombatMonster(null);
              combatMonsterRef.current = null;
            }
            setPendingOfflineRewards({
              minutes_away: data.minutes_away,
              total_actions: 0,
              drops: Object.fromEntries((data.drops ?? []).map((d: { item_type: string; quantity: number }) => [d.item_type, d.quantity])),
              xp_gained: { mining: xp.mining ?? 0, mastery: xp.mastery ?? 0, body: xp.body ?? 0, qi: xp.qi },
              activity: data.session_type === "combat" ? "遊歷" : data.session_type === "meditate" ? "冥想" : "挖礦",
              combat: data.combat,
            });
          })
          .catch(() => { setOfflineLoading(false); });
        accumulatedRef.current = 0;
        lastTickRef.current = Date.now();
        meditationTickStartRef.current = Date.now();
        // combat_tick will resync naturally on next call
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Page load: check if returning from closed browser (only once)
  useEffect(() => {
    if (offlineCheckedRef.current) return;
    offlineCheckedRef.current = true;

    // Only skip if no activity is active
    if (!initialStatus.isMining && !(initialState?.isMeditating) && !(initialState?.combatMonsterId)) return;

    // Call API immediately — offlineCheckedRef above already prevents duplicate calls within the same mount
    fetch("/api/game/offline-rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const xp = data.xp_gained ?? {};
        const hasAnyGain = (xp.mining ?? 0) > 0 || (xp.qi ?? 0) > 0 || (xp.body ?? 0) > 0 || (data.combat?.kills > 0) || (data.combat?.died) || (data.drops?.length ?? 0) > 0;
        if (hasAnyGain) {
          // If combat resulted in death, stop the auto-resumed RAF loop
          if (data.combat?.died) {
            setIsCombating(false);
            setCombatMonster(null);
            combatMonsterRef.current = null;
          }
          setPendingOfflineRewards({
            minutes_away: data.minutes_away,
            total_actions: 0,
            drops: Object.fromEntries((data.drops ?? []).map((d: { item_type: string; quantity: number }) => [d.item_type, d.quantity])),
            xp_gained: { mining: xp.mining ?? 0, mastery: xp.mastery ?? 0, body: xp.body ?? 0, qi: xp.qi },
            activity: data.session_type === "combat" ? "遊歷" : data.session_type === "meditate" ? "冥想" : "挖礦",
            combat: data.combat,
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
  const meditationTickStartRef = useRef(0);
  const meditationRafRef = useRef<number | null>(null);
  const isMeditatingRef = useRef(isMeditating);
  isMeditatingRef.current = isMeditating;
  const localeForMedRef = useRef(locale);
  localeForMedRef.current = locale;

  const MEDITATION_TICK_MS = 10000;

  // Meditation sync is per-tick via RPC — no batch sync needed
  const syncMeditation = useCallback(() => {}, []);
  syncMeditationRef.current = syncMeditation;

  // Meditation tick: call server RPC, update UI from response
  const doMeditationTick = useCallback(() => {
    supabaseRef.current.rpc("meditation_tick", {
      p_slot: slotRef.current,
    }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error || !data) return;
      const result = data as {
        error?: string;
        qi_xp: number;
        gained_xp: number;
        base_xp: number;
        bonus_xp: number;
        qi_array: (string | null)[];
        consumed: string[];
        depleted: string[];
      };
      if (result.error) return;

      // Update QI XP
      setQiXp(result.qi_xp);

      // Update qi_array if stones were depleted
      if (result.depleted && result.depleted.length > 0) {
        qiArrayRef.current = result.qi_array;
      }

      // Update inventory: decrement consumed stones
      if (result.consumed && result.consumed.length > 0) {
        let updated = [...inventoryRef.current];
        for (const itemType of result.consumed) {
          const idx = updated.findIndex((i) => i.item_type === itemType);
          if (idx >= 0) {
            if (updated[idx].quantity <= 1) {
              updated = updated.filter((_, j) => j !== idx);
            } else {
              updated[idx] = { ...updated[idx], quantity: updated[idx].quantity - 1 };
            }
          }
        }
        inventoryRef.current = updated;
        setInventory(updated);
      }

      // Notification
      if (!document.hidden) {
        const isZhNow = localeForMedRef.current === "zh";
        addNotification("🧘", isZhNow ? "靈氣" : "Qi XP", result.gained_xp, "text-jade");
      }

      setLastSyncAt(Date.now());
    }).catch(() => {});
  }, [addNotification]);

  // Meditation RAF tick loop — calls RPC every 10s
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
        doMeditationTick();
        meditationTickStartRef.current = Date.now();
      }
      meditationRafRef.current = requestAnimationFrame(loop);
    };
    meditationRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (meditationRafRef.current) cancelAnimationFrame(meditationRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMeditating, doMeditationTick]);

  // Heartbeat on mount
  useEffect(() => {
    fetch("/api/game/heartbeat", { method: "POST" }).catch(() => {});
  }, []);

  // Sync qiXp when initialState updates (e.g., after router.refresh)
  useEffect(() => {
    if (typeof initialState?.qiXp === "number") {
      setQiXp(initialState.qiXp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState?.qiXp]);

  // --- Smithing state (mutually exclusive with mining/meditation/enlightenment/combat) ---
  const [isSmithing, setIsSmithing] = useState(initialState?.isSmithing ?? false);
  const [smithingRecipeId, setSmithingRecipeId] = useState<string | null>(initialState?.smithingRecipeId ?? null);
  const [smithingLevel, setSmithingLevel] = useState(initialState?.smithingLevel ?? 1);
  const [smithingXp, setSmithingXp] = useState(initialState?.smithingXp ?? 0);
  const [craftCount, setCraftCount] = useState(0);
  const [craftProgress, setCraftProgress] = useState(0);
  const isSmithingRef = useRef(isSmithing);
  isSmithingRef.current = isSmithing;
  const smithingRecipeIdRef = useRef(smithingRecipeId);
  smithingRecipeIdRef.current = smithingRecipeId;
  const smithingTimeSecondsRef = useRef<number>(5);
  const smithingTickStartRef = useRef(0);
  const smithingRafRef = useRef<number | null>(null);
  const smithingTargetCountRef = useRef<number>(0); // 0 = unlimited; >0 = stop after N crafts

  const doSmithingTick = useCallback(() => {
    supabaseRef.current.rpc("smithing_tick", {
      p_slot: slotRef.current,
    }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error || !data) return;
      const result = data as {
        error?: string;
        ok?: boolean;
        crafts?: number;
        xp_gained?: number;
        heat_consumed?: number;
        furnace_heat?: number;
        output?: string;
        output_total_qty?: number;
        recipe_id?: string;
        recipe_time_seconds?: number;
        blocked_by_heat?: boolean;
        blocked_by_material?: string | null;
        level?: number;
        xp?: number;
        leveled_up?: boolean;
        next_event_in_ms?: number;
      };
      if (result.error) return;
      if (!isSmithingRef.current) return;

      if (typeof result.recipe_time_seconds === "number") {
        smithingTimeSecondsRef.current = result.recipe_time_seconds;
      }

      const crafts = result.crafts ?? 0;
      const heat = result.furnace_heat ?? 0;
      setFurnaceHeat(heat);

      // Apply level + in-level XP from RPC (server-authoritative).
      // RPC returns total xp; convert to in-level xp.
      if (typeof result.level === "number") {
        setSmithingLevel(result.level);
      }
      if (typeof result.xp === "number" && typeof result.level === "number") {
        const inLevel = result.xp - totalMiningXpForLevel(result.level);
        setSmithingXp(Math.max(0, inLevel));
      }
      if (result.leveled_up && typeof result.level === "number") {
        const isZh = localeRef.current === "zh";
        addNotification("🎉", isZh ? "煉器升級！" : "Smithing level up!", result.level, "text-spirit-gold");
      }

      let newCraftCount = 0;
      if (crafts > 0 && result.output) {
        setCraftCount((c) => { newCraftCount = c + crafts; return newCraftCount; });

        const outputQty = result.output_total_qty ?? crafts;
        setInventory((prev) => {
          const idx = prev.findIndex((i) => i.item_type === result.output);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + outputQty };
            return next;
          }
          return [...prev, { id: crypto.randomUUID(), user_id: "local", slot: slotRef.current, item_type: result.output!, quantity: outputQty, created_at: "" }];
        });

        const isZh = localeRef.current === "zh";
        const meta = ITEMS[result.output];
        if (meta && !document.hidden) {
          addNotification(meta.icon, isZh ? meta.nameZh : meta.nameEn, outputQty, meta.color, undefined, meta.image);
        }
      }

      // Hit queue target → auto-stop with notification.
      if (smithingTargetCountRef.current > 0 && newCraftCount >= smithingTargetCountRef.current) {
        const isZh = localeRef.current === "zh";
        addNotification("✓", isZh ? "佇列完成" : "Queue done", smithingTargetCountRef.current, "text-jade");
        setIsSmithing(false);
        setSmithingRecipeId(null);
        smithingTargetCountRef.current = 0;
        fetch("/api/game/stop-activity", { method: "POST", keepalive: true }).catch(() => {});
        setLastSyncAt(Date.now());
        return;
      }

      // Resources exhausted → auto-stop. Otherwise progress bar would keep
      // animating without producing anything.
      if (result.blocked_by_heat || result.blocked_by_material) {
        const isZh = localeRef.current === "zh";
        if (result.blocked_by_heat) {
          addNotification("🔥", isZh ? "熱值不足，已停止" : "Out of heat", 0, "text-cinnabar");
        } else if (result.blocked_by_material) {
          const matMeta = ITEMS[result.blocked_by_material];
          const matName = matMeta ? (isZh ? matMeta.nameZh : matMeta.nameEn) : result.blocked_by_material;
          addNotification("⛔", isZh ? `${matName}不足，已停止` : `Out of ${matName}`, 0, "text-cinnabar");
        }
        setIsSmithing(false);
        setSmithingRecipeId(null);
        fetch("/api/game/stop-activity", { method: "POST", keepalive: true }).catch(() => {});
      }

      setLastSyncAt(Date.now());
    }).catch(() => {});
  }, [addNotification]);

  // Smithing RAF tick loop — drives progress bar + invokes RPC each recipe.time_seconds
  useEffect(() => {
    if (!isSmithing) {
      if (smithingRafRef.current) cancelAnimationFrame(smithingRafRef.current);
      setCraftProgress(0);
      return;
    }
    smithingTickStartRef.current = Date.now();
    const loop = () => {
      const tickMs = (smithingTimeSecondsRef.current || 5) * 1000;
      const elapsed = Date.now() - smithingTickStartRef.current;
      const p = Math.min(elapsed / tickMs, 1);
      setCraftProgress(p);
      if (p >= 1) {
        doSmithingTick();
        smithingTickStartRef.current = Date.now();
      }
      smithingRafRef.current = requestAnimationFrame(loop);
    };
    smithingRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (smithingRafRef.current) cancelAnimationFrame(smithingRafRef.current);
    };
  }, [isSmithing, doSmithingTick]);

  const _doStartSmithing = useCallback((recipeId: string, targetCount: number = 0) => {
    if (isMiningRef.current) {
      setIsMining(false);
      setActiveMineId(null);
      activeMineRef.current = null;
      setActionProgress(0);
    }
    if (isMeditatingRef.current) { setIsMeditating(false); }
    if (isCombatingRef.current) { setIsCombating(false); combatMonsterRef.current = null; setCombatMonster(null); }
    if (isEnlighteningRef.current) { syncEnlightenmentRef.current(); setIsEnlightening(false); }
    setTimeout(() => {
      setSmithingRecipeId(recipeId);
      setCraftCount(0);
      setCraftProgress(0);
      smithingTargetCountRef.current = Math.max(0, Math.floor(targetCount));
      setIsSmithing(true);
      fetch("/api/game/start-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "smithing", requested_at: Date.now(), target: { recipe_id: recipeId } }),
        keepalive: true,
      }).catch(() => {});
    }, 50);
  }, []);

  const stopSmithing = useCallback(() => {
    setIsSmithing(false);
    setSmithingRecipeId(null);
    setCraftProgress(0);
    smithingTargetCountRef.current = 0;
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, []);

  // --- Enlightenment state (tracked for mutual exclusion) ---
  const [isEnlightening, setIsEnlightening] = useState((initialState as { isEnlightening?: boolean })?.isEnlightening ?? false);
  const isEnlighteningRef = useRef(isEnlightening);
  isEnlighteningRef.current = isEnlightening;
  const syncEnlightenmentRef = useRef<() => void>(() => {});
  const setEnlightening = useCallback((v: boolean) => { setIsEnlightening(v); isEnlighteningRef.current = v; }, []);

  // --- Activity switch confirmation ---
  const [activitySwitchConfirm, setActivitySwitchConfirm] = useState<ActivitySwitchConfirm | null>(null);
  const dismissActivitySwitch = useCallback(() => setActivitySwitchConfirm(null), []);
  const [dontAskSwitch, setDontAskSwitchState] = useState(() => {
    return (initialState?.userPreferences as Record<string, unknown>)?.dontAskActivitySwitch === true;
  });
  const dontAskSwitchRef = useRef(dontAskSwitch);
  const setDontAskActivitySwitch = useCallback((v: boolean) => {
    setDontAskSwitchState(v);
    dontAskSwitchRef.current = v;
    fetch("/api/game/user-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dontAskActivitySwitch: v }),
    }).catch(() => {});
  }, []);
  const shouldAskSwitch = useCallback(() => {
    return !dontAskSwitchRef.current;
  }, []);
  const getActiveActivityName = useCallback((): string | null => {
    if (isMiningRef.current) return locale === "zh" ? "挖礦" : "Mining";
    if (isMeditatingRef.current) return locale === "zh" ? "冥想" : "Meditation";
    if (isEnlighteningRef.current) return locale === "zh" ? "參悟" : "Enlightenment";
    if (isCombatingRef.current) return locale === "zh" ? "戰鬥" : "Combat";
    if (isSmithingRef.current) return locale === "zh" ? "煉器" : "Smithing";
    return null;
  }, [locale]);

  // --- Actions ---
  const _doStartMining = useCallback((mine: MineData) => {
    if (isMeditatingRef.current) { syncMeditation(); setIsMeditating(false); }
    if (isCombatingRef.current) { setIsCombating(false); combatMonsterRef.current = null; setCombatMonster(null); }
    if (isEnlighteningRef.current) { syncEnlightenmentRef.current(); setIsEnlightening(false); }
    if (isSmithingRef.current) { setIsSmithing(false); setSmithingRecipeId(null); }
    // Cancel respawn on OLD active mine (matches server-side switch_activity behavior)
    const oldMine = activeMineRef.current;
    if (oldMine && oldMine.id !== mine.id) {
      rockDepletedAtMapRef.current = { ...rockDepletedAtMapRef.current, [oldMine.id]: null };
      setRockDepletedAtMap((m) => ({ ...m, [oldMine.id]: null }));
    }
    // Bug 3 fix: optimistic respawn when clicking a HP=0 mine.
    // Server's mine_action will trigger respawn restart (HP=0 + depleted=NULL → set depleted=now);
    // anchor depleted_at locally now so RAF immediately shows respawn animation
    // instead of mining bar flashing for ~100ms before RPC returns.
    const savedHp = rockHpMapRef.current[mine.id];
    if (savedHp === 0) {
      const nowMs = Date.now();
      rockDepletedAtMapRef.current = { ...rockDepletedAtMapRef.current, [mine.id]: nowMs };
      setRockDepletedAtMap((m) => ({ ...m, [mine.id]: nowMs }));
    }
    // Reset progress + animation timer immediately to prevent visual stutter on mine switch
    setActionProgress(0);
    tickStartRef.current = Date.now();
    activeMineRef.current = mine;
    setActiveMineId(mine.id);
    setIsMining(true);
    accumulatedRef.current = 0;
    respawningRef.current = false;
    respawnAccRef.current = 0;
    setRespawnProgress(0);
    fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mining", mine_id: mine.id, requested_at: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  }, [syncMeditation]);

  const stopMining = useCallback(() => {
    setIsMining(false);
    setActionProgress(0);
    setRespawnProgress(0);
    // Clear depleted_at on the active mine (matches server-side stop_activity behavior).
    // This cancels respawn so re-clicking starts fresh.
    const mine = activeMineRef.current;
    if (mine) {
      rockDepletedAtMapRef.current = { ...rockDepletedAtMapRef.current, [mine.id]: null };
      setRockDepletedAtMap((m) => ({ ...m, [mine.id]: null }));
    }
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, []);

  const _doStartMeditation = useCallback(() => {
    // Stop current activity first
    if (isMiningRef.current) {
      setIsMining(false);
      setActiveMineId(null);
      activeMineRef.current = null;
      setActionProgress(0);
    }
    if (isCombatingRef.current) { setIsCombating(false); combatMonsterRef.current = null; setCombatMonster(null); }
    if (isEnlighteningRef.current) { syncEnlightenmentRef.current(); setIsEnlightening(false); }
    if (isSmithingRef.current) { setIsSmithing(false); setSmithingRecipeId(null); }
    // Delay starting new activity to let cleanup useEffects run first
    setTimeout(() => {
      setIsMeditating(true);
      fetch("/api/game/start-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meditate", requested_at: Date.now() }),
        keepalive: true,
      }).catch(() => {});
    }, 50);
  }, []);

  const stopMeditation = useCallback(() => {
    syncMeditation();
    setIsMeditating(false);
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [syncMeditation]);

  // --- Equipment set state ---
  const [equipSetsState, setEquipSetsState] = useState<Record<string, Record<string, string>>>(
    (initialState?.equipmentSets as Record<string, Record<string, string>>) ?? { "1": {}, "2": {} }
  );
  const [activeEquipSetState, setActiveEquipSetState] = useState<number>(
    (initialState?.activeEquipmentSet as number) ?? 1
  );
  const equipSetsRef = useRef(equipSetsState);
  const activeEquipSetRef = useRef(activeEquipSetState);
  const updateEquipmentSet = useCallback((setNum: number, sets: Record<string, Record<string, string>>) => {
    setActiveEquipSetState(setNum);
    setEquipSetsState(sets);
    activeEquipSetRef.current = setNum;
    equipSetsRef.current = sets;
  }, []);

  // --- Consumable state (synced to DB) ---
  const [consumableSlots, setConsumableSlots] = useState<(string | null)[]>(
    (initialState?.consumableSlots as (string | null)[]) ?? [null, null, null]
  );
  const [activeConsumableIdx, setActiveConsumableIdxState] = useState(0);

  const setConsumableSlot = useCallback((idx: number, itemType: string | null) => {
    setConsumableSlots((prev) => {
      const next = [...prev];
      next[idx] = itemType;
      // Sync to DB
      fetch("/api/game/consumable-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumable_slots: next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const setActiveConsumableIdx = useCallback((idx: number) => {
    setActiveConsumableIdxState(idx);
  }, []);

  const consumeItem = useCallback(() => {
    const itemType = consumableSlots[activeConsumableIdx];
    if (!itemType) return;
    const itemDef = getItem(itemType);
    if (!itemDef?.healHp) return;

    // Optimistic HP update (cap at player_max_hp; server-canonical max).
    const heal = itemDef.healHp;
    const maxHp = combatPlayerMaxHpRef.current || playerHpRef2.current;
    playerHpRef2.current = Math.min(maxHp, playerHpRef2.current + heal);
    setPlayerHp(playerHpRef2.current);

    // Decrement inventory optimistically
    setInventory((prev) => {
      const next = prev.map((inv) =>
        inv.item_type === itemType ? { ...inv, quantity: inv.quantity - 1 } : inv
      ).filter((inv) => inv.quantity > 0);
      const remaining = next.find((inv) => inv.item_type === itemType);
      if (!remaining) {
        setConsumableSlots((slots) => {
          const updated = [...slots];
          updated[activeConsumableIdx] = null;
          return updated;
        });
      }
      return next;
    });

    // Server sync — /consume route updates session.payload.player_hp during combat.
    fetch("/api/game/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_type: itemType }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && typeof data.player_hp === "number") {
          playerHpRef2.current = data.player_hp;
          setPlayerHp(data.player_hp);
        }
      })
      .catch(() => {});
  }, [consumableSlots, activeConsumableIdx]);

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
  const combatPlayerMaxHpRef = useRef(100);
  // Last server-confirmed attack timestamps (ISO strings from RPC) — drive progress bars
  const combatLastPlayerAttackRef = useRef<number>(0);
  const combatLastMonsterAttackRef = useRef<number>(0);
  const combatRafRef = useRef<number | null>(null);
  const combatTickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const combatLogIdRef = useRef(0);
  const isCombatingRef = useRef(false);
  isCombatingRef.current = isCombating;

  const COMBAT_ATTACK_MS = PLAYER_ATTACK_INTERVAL * 1000;

  const addCombatLog = useCallback((text: string, color: string) => {
    const id = ++combatLogIdRef.current;
    setCombatLogs((prev) => [...prev.slice(-8), { id, text, color }]);
  }, []);

  // Server-authoritative combat tick — drives ALL combat state.
  // Client only animates progress bars + logs deltas between calls.
  const callCombatTick = useCallback(() => {
    if (!isCombatingRef.current) return;
    supabaseRef.current.rpc("combat_tick", { p_slot: slotRef.current })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (error || !data) {
          if (!isCombatingRef.current) return;
          if (combatTickTimeoutRef.current) clearTimeout(combatTickTimeoutRef.current);
          combatTickTimeoutRef.current = setTimeout(callCombatTick, 500);
          return;
        }
        const result = data as {
          error?: string;
          player_hp: number;
          player_max_hp: number;
          monster_hp: number;
          monster_max_hp: number;
          monster_id: string;
          kills: number;
          kills_delta: number;
          body_xp_delta: number;
          drops: { item: string; qty: number }[];
          loot_box: { item_type: string; quantity: number }[];
          loot_full: boolean;
          died: boolean;
          next_event_in_ms: number;
          player_dmg: number;
          monster_dmg: number;
          last_player_attack_at: string;
          last_monster_attack_at: string;
        };
        if (result.error) {
          if (!isCombatingRef.current) return;
          // Common race: start-activity hasn't created the session yet.
          // Retry until the session exists, instead of freezing.
          if (result.error === "not_combatting" || result.error === "no_monster") {
            if (combatTickTimeoutRef.current) clearTimeout(combatTickTimeoutRef.current);
            combatTickTimeoutRef.current = setTimeout(callCombatTick, 300);
          }
          return;
        }
        if (!isCombatingRef.current) return;
        const isZh = localeRef.current === "zh";
        const monster = combatMonsterRef.current;

        const prevPlayerHp = playerHpRef2.current;
        const prevMonsterHp = monsterHpRef2.current;
        playerHpRef2.current = result.player_hp;
        monsterHpRef2.current = result.monster_hp;
        combatPlayerMaxHpRef.current = result.player_max_hp;
        setPlayerHp(result.player_hp);
        setMonsterHp(result.monster_hp);

        if (monster) {
          if (prevMonsterHp > result.monster_hp) {
            addCombatLog(
              isZh ? `你對${monster.nameZh}造成 ${result.player_dmg} 點傷害` : `You deal ${result.player_dmg} to ${monster.nameEn}`,
              "text-spirit-gold"
            );
          }
          if (prevPlayerHp > result.player_hp) {
            addCombatLog(
              isZh ? `${monster.nameZh}對你造成 ${result.monster_dmg} 點傷害` : `${monster.nameEn} deals ${result.monster_dmg} to you`,
              "text-cinnabar"
            );
          }
        }

        if (result.kills_delta > 0 && monster) {
          for (let i = 0; i < result.kills_delta; i++) {
            addCombatLog(isZh ? `${monster.nameZh}被擊敗！` : `${monster.nameEn} defeated!`, "text-jade");
          }
          setCombatKillCount((c) => c + result.kills_delta);
          addNotification("⚔️", isZh ? `擊敗 ${monster.nameZh}` : `Defeated ${monster.nameEn}`, result.kills_delta, "text-cinnabar");
          if (result.body_xp_delta > 0) {
            addNotification("💪", isZh ? "煉體經驗" : "Body XP", Number(result.body_xp_delta), "text-spirit-gold");
          }
          for (const d of result.drops ?? []) {
            const meta = ITEMS[d.item];
            if (meta) addNotification(meta.icon, isZh ? meta.nameZh : meta.nameEn, d.qty, meta.color, undefined, meta.image);
          }
          if (result.loot_full) {
            addNotification("📦", isZh ? "戰利品已滿" : "Loot box full", 0, "text-cinnabar");
          }
        }

        if (Array.isArray(result.loot_box)) {
          setCombatLootSlots(result.loot_box);
        }

        combatLastPlayerAttackRef.current = new Date(result.last_player_attack_at).getTime();
        combatLastMonsterAttackRef.current = new Date(result.last_monster_attack_at).getTime();

        if (result.died) {
          addCombatLog(isZh ? "你被擊敗了！" : "You were defeated!", "text-cinnabar");
          setIsCombating(false);
          combatMonsterRef.current = null;
          setCombatMonster(null);
          if (combatTickTimeoutRef.current) {
            clearTimeout(combatTickTimeoutRef.current);
            combatTickTimeoutRef.current = null;
          }
          return;
        }

        const delay = Math.max(50, result.next_event_in_ms);
        if (combatTickTimeoutRef.current) clearTimeout(combatTickTimeoutRef.current);
        combatTickTimeoutRef.current = setTimeout(callCombatTick, delay);
      })
      .catch(() => {
        if (combatTickTimeoutRef.current) clearTimeout(combatTickTimeoutRef.current);
        combatTickTimeoutRef.current = setTimeout(callCombatTick, 2000);
      });
  }, [addCombatLog, addNotification]);
  // No-op syncCombat — kept for API parity with visibility-change handler that calls it
  syncCombatRef.current = useCallback(() => {}, []);

  // Drives combat_tick chain when isCombating toggles
  useEffect(() => {
    if (!isCombating || !combatMonsterRef.current) {
      if (combatTickTimeoutRef.current) {
        clearTimeout(combatTickTimeoutRef.current);
        combatTickTimeoutRef.current = null;
      }
      if (combatRafRef.current) cancelAnimationFrame(combatRafRef.current);
      setCombatPlayerProgress(0);
      setCombatMonsterProgress(0);
      return;
    }
    combatLastPlayerAttackRef.current = Date.now();
    combatLastMonsterAttackRef.current = Date.now();
    callCombatTick();
    return () => {
      if (combatTickTimeoutRef.current) {
        clearTimeout(combatTickTimeoutRef.current);
        combatTickTimeoutRef.current = null;
      }
    };
  }, [isCombating, callCombatTick]);

  // Pure progress-bar animation RAF — interpolates between server-confirmed attack timestamps
  useEffect(() => {
    if (!isCombating || !combatMonsterRef.current) return;
    const loop = () => {
      const monster = combatMonsterRef.current;
      if (!monster || !isCombatingRef.current) return;
      const now = Date.now();
      const monsterAttackMs = monster.attackSpeed * 1000;
      const pSinceLast = combatLastPlayerAttackRef.current ? now - combatLastPlayerAttackRef.current : 0;
      const mSinceLast = combatLastMonsterAttackRef.current ? now - combatLastMonsterAttackRef.current : 0;
      setCombatPlayerProgress(Math.min(pSinceLast / COMBAT_ATTACK_MS, 1));
      setCombatMonsterProgress(Math.min(mSinceLast / monsterAttackMs, 1));
      combatRafRef.current = requestAnimationFrame(loop);
    };
    combatRafRef.current = requestAnimationFrame(loop);
    return () => { if (combatRafRef.current) cancelAnimationFrame(combatRafRef.current); };
  }, [isCombating, COMBAT_ATTACK_MS]);

  // Resume combat from SSR initialState (combat_tick fills HPs on first call)
  useEffect(() => {
    if (initialState?.lootBox && initialState.lootBox.length > 0) {
      setCombatLootSlots(initialState.lootBox);
    }
    if (initialState?.combatMonsterId) {
      for (const zone of COMBAT_ZONES) {
        const monster = zone.monsters.find((m) => m.id === initialState.combatMonsterId);
        if (monster) {
          setCombatMonster(monster);
          combatMonsterRef.current = monster;
          monsterHpRef2.current = monster.hp;
          setMonsterHp(monster.hp);
          setIsCombating(true);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _doStartCombat = useCallback((monster: Monster) => {
    if (isMiningRef.current) { setIsMining(false); setActiveMineId(null); activeMineRef.current = null; setActionProgress(0); }
    if (isMeditatingRef.current) { syncMeditation(); setIsMeditating(false); }
    if (isEnlighteningRef.current) { syncEnlightenmentRef.current(); setIsEnlightening(false); }
    if (isSmithingRef.current) { setIsSmithing(false); setSmithingRecipeId(null); }

    setTimeout(() => {
      setCombatMonster(monster);
      combatMonsterRef.current = monster;
      // Placeholder HPs — combat_tick will overwrite with canonical values on first response
      monsterHpRef2.current = monster.hp;
      setMonsterHp(monster.hp);
      setCombatLogs([]);
      setCombatKillCount(0);
      setIsCombating(true);

      fetch("/api/game/start-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "combat", requested_at: Date.now(), target: { monster_id: monster.id } }),
        keepalive: true,
      }).catch(() => {});
    }, 50);
  }, [syncMeditation]);

  const stopCombat = useCallback(() => {
    setIsCombating(false);
    combatMonsterRef.current = null;
    setCombatMonster(null);
    if (combatTickTimeoutRef.current) {
      clearTimeout(combatTickTimeoutRef.current);
      combatTickTimeoutRef.current = null;
    }
    fetch("/api/game/stop-activity", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  const collectCombatLoot = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    // Read current loot_box from state — server writes profile.loot_box during combat_tick
    const currentLoot = combatLootSlots;
    if (currentLoot.length === 0) return { ok: true };
    const aggregated: Record<string, number> = {};
    for (const slot of currentLoot) {
      aggregated[slot.item_type] = (aggregated[slot.item_type] ?? 0) + slot.quantity;
    }
    // Optimistic clear
    const prevLoot = currentLoot;
    setCombatLootSlots([]);
    setInventory((prev) => {
      let next = [...prev];
      for (const [itemType, qty] of Object.entries(aggregated)) {
        const isEquip = hasTag(itemType, "equipment");
        if (isEquip) {
          for (let i = 0; i < qty; i++) {
            next = [...next, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: itemType, quantity: 1, created_at: "" }];
          }
        } else {
          const existing = next.find((it) => it.item_type === itemType);
          if (existing) {
            next = next.map((it) => it.item_type === itemType ? { ...it, quantity: it.quantity + qty } : it);
          } else {
            next = [...next, { id: crypto.randomUUID(), user_id: "local", slot: 1, item_type: itemType, quantity: qty, created_at: "" }];
          }
        }
      }
      return next;
    });
    fetch("/api/game/collect-loot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: aggregated }),
    }).then(async (res) => {
      if (!res.ok) setCombatLootSlots(prevLoot);
    }).catch(() => {
      setCombatLootSlots(prevLoot);
    });
    return { ok: true };
  }, [combatLootSlots]);

  // --- Context value ---
  const value: GameContextValue = {
    isMining, activeMineId, actionProgress,
    rockHp, rockMaxHp, respawnProgress, rockHpMap, rockLastActiveMap, rockDepletedAtMap,
    miningLevel, miningXp, miningXpMax,
    masteryLevels, masteryXps, masteryXpMaxs,
    bodyStage, bodyXp, realm, inventory,
    notifications, pendingOfflineRewards, offlineLoading,
    isMeditating, qiXp, meditationProgress,
    equipment: equipSetsState[String(activeEquipSetState)] ?? {},
    equipmentSets: equipSetsState,
    activeEquipmentSet: activeEquipSetState,
    bodyLevel: initialState?.bodyLevel ?? 1,
    lootBox: initialState?.lootBox ?? [],
    isCombating, combatMonster, playerHp,
    playerMaxHp: isCombating
      ? (combatPlayerMaxHpRef.current || computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: equipSetsState[String(activeEquipSetState)] ?? {} }).hp)
      : computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: equipSetsState[String(activeEquipSetState)] ?? {} }).hp,
    playerAtk: computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: equipSetsState[String(activeEquipSetState)] ?? {} }).atk,
    playerDef: computeStats({ bodyLevel: initialState?.bodyLevel ?? 1, equipment: equipSetsState[String(activeEquipSetState)] ?? {} }).def,
    monsterHp, combatPlayerProgress, combatMonsterProgress, combatKillCount, combatLogs, combatLootSlots,
    consumableSlots, activeConsumableIdx,
    activitySwitchConfirm, dismissActivitySwitch, setDontAskActivitySwitch,
    startMining: useCallback((mine: MineData) => {
      const current = getActiveActivityName();
      const targetName = locale === "zh" ? "挖礦" : "Mining";
      if (current && current !== targetName && shouldAskSwitch()) {
        setActivitySwitchConfirm({ from: current, to: targetName, onConfirm: () => { setActivitySwitchConfirm(null); _doStartMining(mine); } });
      } else { _doStartMining(mine); }
    }, [getActiveActivityName, shouldAskSwitch, _doStartMining, locale]),
    stopMining,
    startMeditation: useCallback(() => {
      const current = getActiveActivityName();
      if (current && shouldAskSwitch()) {
        const targetName = locale === "zh" ? "冥想" : "Meditation";
        setActivitySwitchConfirm({ from: current, to: targetName, onConfirm: () => { setActivitySwitchConfirm(null); _doStartMeditation(); } });
      } else { _doStartMeditation(); }
    }, [getActiveActivityName, shouldAskSwitch, _doStartMeditation, locale]),
    stopMeditation,
    startCombat: useCallback((monster: Monster) => {
      const current = getActiveActivityName();
      if (current && shouldAskSwitch()) {
        const targetName = locale === "zh" ? "戰鬥" : "Combat";
        setActivitySwitchConfirm({ from: current, to: targetName, onConfirm: () => { setActivitySwitchConfirm(null); _doStartCombat(monster); } });
      } else { _doStartCombat(monster); }
    }, [getActiveActivityName, shouldAskSwitch, _doStartCombat, locale]),
    stopCombat, collectCombatLoot,
    isSmithing, smithingRecipeId, smithingLevel, smithingXp, craftCount, craftProgress,
    startSmithing: useCallback((recipeId: string, targetCount?: number) => {
      const current = getActiveActivityName();
      if (current && shouldAskSwitch()) {
        const targetName = locale === "zh" ? "煉器" : "Smithing";
        setActivitySwitchConfirm({ from: current, to: targetName, onConfirm: () => { setActivitySwitchConfirm(null); _doStartSmithing(recipeId, targetCount); } });
      } else { _doStartSmithing(recipeId, targetCount); }
    }, [getActiveActivityName, shouldAskSwitch, _doStartSmithing, locale]),
    stopSmithing,
    setConsumableSlot, setActiveConsumableIdx, consumeItem,
    updateQiArray: (next: (string | null)[]) => { qiArrayRef.current = next; },
    addNotification,
    dismissOfflineRewards,
    updateInventory: setInventory,
    updateEquipmentSet,
    isEnlightening,
    setEnlightening,
    registerEnlightenmentSync: useCallback((fn: () => void) => { syncEnlightenmentRef.current = fn; }, []),
    requestActivitySwitch: useCallback((targetName: string, onConfirm: () => void) => {
      const current = getActiveActivityName();
      if (current && shouldAskSwitch()) {
        setActivitySwitchConfirm({ from: current, to: targetName, onConfirm: () => { setActivitySwitchConfirm(null); onConfirm(); } });
      } else {
        onConfirm();
      }
    }, [getActiveActivityName, shouldAskSwitch]),
    furnaceHeat,
    setFurnaceHeat,
    hasEntered,
    setHasEntered,
    applyBreakthrough: useCallback((data: { realm: string; new_level: number; leftover_xp: number }) => {
      setRealm(data.realm);
      setBodyStage(data.new_level);
      bodyStageRef.current = data.new_level;
      setBodyXp(data.leftover_xp);
    }, []),
    lastSyncAt,
    flushAllPending: useCallback(() => {
      // Mining is per-action RPC — only flush other skills
      if (isMeditatingRef.current) syncMeditationRef.current();
      if (isCombatingRef.current) syncCombatRef.current();
      if (isEnlighteningRef.current) syncEnlightenmentRef.current();
      setLastSyncAt(Date.now());
    }, []),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
