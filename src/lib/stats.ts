// Centralized stat computation — the ONLY place final stats are calculated.
// All sources (base, realm, equipment, techniques, buffs) are combined here.
// To add a new source, add one line in computeStats(). Nothing else needs to change.

import { getItem } from "./items";

// === Base values — adjust these to tune the starting experience ===
export const BASE_STATS = {
  hp: 100,
  mp: 0,
  atk: 1,
  int: 0,
  def: 0,
  spd: 0,
  critRate: 0,   // percentage
  critDmg: 0,    // percentage
};

export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  int: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
}

// === Source: Realm breakthrough ===
// Body tempering: each level gives flat bonuses
function realmBonus(bodyLevel: number): Stats {
  const levels = Math.max(bodyLevel - 1, 0);
  return {
    hp: levels * 10,
    mp: 0,
    atk: levels,
    int: 0,
    def: levels,
    spd: 0,
    critRate: 0,
    critDmg: 0,
  };
}

// === Source: Equipment ===
function equipmentBonus(equipment: Record<string, string>): Stats {
  const total: Stats = { hp: 0, mp: 0, atk: 0, int: 0, def: 0, spd: 0, critRate: 0, critDmg: 0 };
  for (const itemType of Object.values(equipment)) {
    const item = getItem(itemType);
    if (!item?.equipStats) continue;
    total.hp += item.equipStats.hp ?? 0;
    total.mp += item.equipStats.mp ?? 0;
    total.atk += item.equipStats.atk ?? 0;
    total.def += item.equipStats.def ?? 0;
    // Future: int, spd, critRate, critDmg from equipment
  }
  return total;
}

// === Source: Techniques (placeholder — hook up when technique effects are defined) ===
// function techniqueBonus(techniques: PlayerTechnique[]): Stats { ... }

// === Source: Buffs (placeholder — hook up when buff system exists) ===
// function buffBonus(buffs: ActiveBuff[]): Stats { ... }

// === Final computation ===
export function computeStats(params: {
  bodyLevel: number;
  equipment: Record<string, string>;
  // Future params:
  // techniques?: PlayerTechnique[];
  // buffs?: ActiveBuff[];
}): Stats {
  const base = { ...BASE_STATS };
  const realm = realmBonus(params.bodyLevel);
  const equip = equipmentBonus(params.equipment);

  return {
    hp: base.hp + realm.hp + equip.hp,
    mp: base.mp + realm.mp + equip.mp,
    atk: base.atk + realm.atk + equip.atk,
    int: base.int + realm.int + equip.int,
    def: base.def + realm.def + equip.def,
    spd: base.spd + realm.spd + equip.spd,
    critRate: base.critRate + realm.critRate + equip.critRate,
    critDmg: base.critDmg + realm.critDmg + equip.critDmg,
  };
}

// === Breakdown — for UI "where does this number come from?" ===
export function computeStatsBreakdown(params: {
  bodyLevel: number;
  equipment: Record<string, string>;
}): { base: Stats; realm: Stats; equipment: Stats; total: Stats } {
  const base = { ...BASE_STATS };
  const realm = realmBonus(params.bodyLevel);
  const equip = equipmentBonus(params.equipment);
  const total = computeStats(params);
  return { base, realm, equipment: equip, total };
}
