// Database types — matches supabase/migrations/ table schemas

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// profiles — player cultivation state and inventory capacity
export interface Profile {
  id: string; // uuid, references auth.users
  user_id: string; // uuid, references auth.users
  slot: number; // 1-3, save slot
  cultivation_stage: number; // 1-9 for 練體 stages
  body_xp: number; // current 練體 XP within stage
  body_skill_level: number; // 1-99 post-練體9 skill track (starts at 9)
  body_skill_xp: number; // XP for post-練體9 skill track
  inventory_slots: number; // base 20, expandable via shop
  dao_points: number; // 天道值, earned by sacrificing items
  created_at: string; // timestamptz
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
  xp_body: number; // 練體 XP awarded per action
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
  xp_body: number; // 練體 XP per action for this mine
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
