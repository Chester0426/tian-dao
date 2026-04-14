// Database types — matches supabase/migrations/ table schemas

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// profiles — player cultivation state and inventory capacity
export type Realm = "煉體" | "練氣" | "築基" | "金丹" | "元嬰";

export interface Profile {
  id: string;
  user_id: string;
  slot: number;
  realm: Realm; // current active realm
  realm_level: number; // current level in active realm
  cultivation_stage: number; // legacy
  // Independent realm data
  body_level: number; // 煉體 level (1-9, 9+=巔峰+N)
  body_xp: number; // 煉體 current XP
  qi_level: number; // 練氣 level (0=not unlocked, 1-13)
  qi_xp: number; // 練氣 current XP
  qi_fail_bonus?: Record<string, number>; // permanent +% per level from failed breakthroughs
  qi_array?: (string | null)[]; // 5 slots; each stores an item_type or null
  equipment?: Record<string, string>; // slot_id → item_type (legacy, use equipment_sets)
  equipment_sets?: Record<string, Record<string, string>>; // { "1": {...}, "2": {...} }
  active_equipment_set?: number;
  foundation_level: number; // 築基 level (0=not unlocked)
  foundation_xp: number;
  core_level: number; // 金丹 level (0=not unlocked)
  core_xp: number;
  nascent_level: number; // 元嬰 level (0=not unlocked)
  nascent_xp: number;
  body_skill_level: number;
  body_skill_xp: number;
  inventory_slots: number;
  dao_points: number;
  created_at: string;
}

// mining_skills — mining skill level and XP per player
export interface MiningSkill {
  id: string; // uuid
  user_id: string; // uuid, references auth.users
  slot: number; // 1-3, save slot
  level: number; // 1-99
  xp: number; // total accumulated XP
  created_at: string; // timestamptz
}

// mine_masteries — mastery level and XP per player per mine
export interface MineMastery {
  id: string; // uuid
  user_id: string; // uuid, references auth.users
  slot: number; // 1-3, save slot
  mine_id: string; // uuid, references mines
  level: number; // 1-99
  xp: number; // total accumulated XP
  created_at: string; // timestamptz
}

// inventory_items — player inventory, one row per item type per player
export interface InventoryItem {
  id: string; // uuid
  user_id: string; // uuid, references auth.users
  slot: number; // 1-3, save slot
  item_type: string; // e.g. "coal", "copper_ore", "spirit_stone_fragment"
  quantity: number; // stackable, no cap per slot
  created_at: string; // timestamptz
}

// LootEntry — one entry in a mine's loot table
export interface LootEntry {
  item_type: string;
  probability: number; // 0-1, sum of all entries must equal 1
  xp_mining: number; // mining skill XP awarded per action
  xp_mastery: number; // mine mastery XP awarded per action
  xp_body: number; // 煉體 XP awarded per action
}

// mines — mine definitions with loot tables and rock mechanics
export interface Mine {
  id: string; // uuid
  name: string; // e.g. "枯竭礦脈"
  slug: string; // e.g. "depleted_vein"
  required_level: number; // minimum mining skill level to access
  action_interval_ms: number; // ms per mining action (e.g. 3000 = 3s)
  loot_table: LootEntry[]; // JSONB — probability table for drops
  rock_base_hp: number; // base rock HP (actual = base + mastery_level)
  respawn_seconds: number; // seconds until rock respawns after HP = 0
  xp_mining: number; // mining skill XP per action for this mine
  xp_mastery: number; // mastery XP per action for this mine
  xp_body: number; // 煉體 XP per action for this mine
  created_at: string; // timestamptz
}

// idle_sessions — tracks active/completed idle activity
export interface IdleSession {
  id: string; // uuid
  user_id: string; // uuid, references auth.users
  slot: number; // 1-3, save slot
  type: "mining"; // activity type (only mining in MVP)
  mine_id: string | null; // uuid, references mines (null for non-mining)
  started_at: string; // timestamptz — when idle began
  ended_at: string | null; // timestamptz — when idle ended (null = active)
  created_at: string; // timestamptz
}

// Mastery double-drop tier table
// 10→1%, 20→2%, 30→3%, 40→4%, 50→5%, 60→6%, 70→7%, 80→8%, 90→9%, 99→15%
export const MASTERY_DOUBLE_DROP_CHANCE: Record<number, number> = {
  10: 0.01,
  20: 0.02,
  30: 0.03,
  40: 0.04,
  50: 0.05,
  60: 0.06,
  70: 0.07,
  80: 0.08,
  90: 0.09,
  99: 0.15,
};

// Returns the double-drop probability for a given mastery level
export function getMasteryDoubleDropChance(masteryLevel: number): number {
  const tiers = [99, 90, 80, 70, 60, 50, 40, 30, 20, 10];
  for (const tier of tiers) {
    if (masteryLevel >= tier) return MASTERY_DOUBLE_DROP_CHANCE[tier];
  }
  return 0;
}

// Melvor XP curve — floor(1/4 * (L-1 + 300 * 2^((L-1)/7)))
// Returns XP required to reach the given level from level 1
export function melvorXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor((1 / 4) * (l - 1 + 300 * Math.pow(2, (l - 1) / 7)));
  }
  return total;
}

// Custom body tempering XP table (stage 1-9)
// Based on 2,3,5,7,9,11,13,15 minute progression with 5 XP per 3s action
const BODY_XP_TABLE: Record<number, number> = {
  1: 200,
  2: 300,
  3: 500,
  4: 700,
  5: 900,
  6: 1100,
  7: 1300,
  8: 1500,
};

// Mine display names by slug
export const MINE_NAMES: Record<string, { zh: string; en: string }> = {
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

// Spirit stone bonuses (per-tick qi added while equipped in 聚靈陣).
// Item identity lives in @/lib/items; this map only stores the numeric bonus.
import { hasTag } from "./items";

export const SPIRIT_STONE_BONUSES: Record<string, number> = {
  spirit_stone_fragment: 10,
};

export function isSpiritStone(itemType: string): boolean {
  return hasTag(itemType, "spirit_stone");
}

export function spiritStoneBonus(itemType: string | null | undefined): number {
  if (!itemType) return 0;
  return SPIRIT_STONE_BONUSES[itemType] ?? 0;
}

// 練氣 XP table — Lv.1→13 (13 = 巔峰, 下一步嘗試築基)
const QI_XP_TABLE: Record<number, number> = {
  1: 1200, 2: 1800, 3: 2500, 4: 3300, 5: 4200, 6: 5200,
  7: 6300, 8: 7500, 9: 8800, 10: 10200, 11: 11700, 12: 13300,
  13: 13300, // 13→築基 uses same xp cost
};

/** XP required to break through from qi level (1-13). */
export function qiXpForStage(level: number): number {
  return QI_XP_TABLE[level] ?? 13300;
}

// Base 練氣 breakthrough success rate (%). Failures permanently add +1% per attempt.
const QI_BASE_RATE: Record<number, number> = {
  1: 100, 2: 100, 3: 100, 4: 100, 5: 100,
  6: 99, 7: 98, 8: 97, 9: 95, 10: 90, 11: 85, 12: 80,
  13: 1, // 13 → 築基
};

export function qiBaseRate(level: number): number {
  return QI_BASE_RATE[level] ?? 100;
}

/** XP required to break through from the given body tempering level.
 *  Level 1-8: fixed table. Level 9+ (巔峰+N): base 1500, +10% per level. */
export function bodyXpForStage(level: number): number {
  if (level <= 8) return BODY_XP_TABLE[level] ?? 2000;
  // 巔峰+N: 1500 * 1.1^(level - 8)
  return Math.floor(1500 * Math.pow(1.1, level - 8));
}

/** Display name for realm (with 期) */
export const REALM_DISPLAY: Record<Realm, { zh: string; en: string; enDesc: string }> = {
  "煉體": { zh: "煉體期", en: "Body Refining", enDesc: "Strengthening the physical shell." },
  "練氣": { zh: "練氣期", en: "Qi Condensation", enDesc: "Gathering and compressing spiritual energy." },
  "築基": { zh: "築基期", en: "Foundation Establishment", enDesc: "Building the base for immortality." },
  "金丹": { zh: "金丹期", en: "Golden Core", enDesc: "Forming the inner core of power." },
  "元嬰": { zh: "元嬰期", en: "Nascent Soul", enDesc: "Birthing the spiritual infant within." },
};

/** Get display label for realm level */
export function getRealmLevelLabel(realm: Realm, level: number, locale: "zh" | "en" = "zh"): string {
  if (locale === "en") {
    if (realm === "煉體") return level >= 9 ? `Peak${level > 9 ? "+" + (level - 9) : ""}` : `Lv.${level}`;
    if (realm === "練氣") return level >= 13 ? "Peak" : `Lv.${level}`;
    const namedLevelsEn = ["Early", "Mid-Early", "Mid", "Late", "Peak"];
    return namedLevelsEn[level - 1] ?? `Lv.${level}`;
  }
  if (realm === "煉體") return level >= 9 ? `巔峰${level > 9 ? "+" + (level - 9) : ""}` : `${level} 級`;
  if (realm === "練氣") return level >= 13 ? "巔峰" : `${level} 級`;
  const namedLevels = ["初期", "前期", "中期", "後期", "巔峰"];
  return namedLevels[level - 1] ?? `${level}`;
}

/** Total stat gains from realm breakthroughs */
export function getRealmStats(realm: Realm, level: number) {
  if (realm === "煉體") {
    const breakthroughs = level - 1;
    return { hp: breakthroughs * 10, atk: breakthroughs, def: breakthroughs };
  }
  return { hp: 0, atk: 0, def: 0 };
}
