import { describe, it, expect } from "vitest";
import { calcCombatRound, simulateCombat, PLAYER_ATTACK_INTERVAL } from "../combat-sim";
import type { Stats } from "../stats";
import type { Monster } from "../combat";

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return { hp: 100, mp: 0, atk: 10, int: 0, def: 0, spd: 0, critRate: 0, critDmg: 0, ...overrides };
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: "test", nameZh: "測試怪", nameEn: "Test Monster", icon: "👹",
    hp: 30, atk: 5, def: 0, attackSpeed: 2, bodyXp: 10,
    drops: [{ item_type: "coal", quantity: 1, rate: 1 }],
    ...overrides,
  };
}

describe("calcCombatRound", () => {
  it("calculates player damage = atk - monster def, min 1", () => {
    const result = calcCombatRound(makeStats({ atk: 10 }), makeMonster({ def: 3 }));
    expect(result.playerDmg).toBe(7);
  });

  it("player damage is at least 1 even if def > atk", () => {
    const result = calcCombatRound(makeStats({ atk: 1 }), makeMonster({ def: 99 }));
    expect(result.playerDmg).toBe(1);
  });

  it("calculates monster damage = monster atk - player def, min 1", () => {
    const result = calcCombatRound(makeStats({ def: 3 }), makeMonster({ atk: 8 }));
    expect(result.monsterDmg).toBe(5);
  });

  it("monster damage is at least 1", () => {
    const result = calcCombatRound(makeStats({ def: 999 }), makeMonster({ atk: 1 }));
    expect(result.monsterDmg).toBe(1);
  });

  it("hitsToKill = ceil(monsterHp / playerDmg)", () => {
    const result = calcCombatRound(makeStats({ atk: 10 }), makeMonster({ hp: 25, def: 0 }));
    expect(result.hitsToKill).toBe(3); // ceil(25/10) = 3
  });

  it("timePerKill = hitsToKill * PLAYER_ATTACK_INTERVAL", () => {
    const result = calcCombatRound(makeStats({ atk: 10 }), makeMonster({ hp: 30, def: 0 }));
    expect(result.timePerKill).toBe(3 * PLAYER_ATTACK_INTERVAL);
  });

  it("player first-strike: monster doesn't hit back on the kill round", () => {
    // 3 hits to kill, 9s total, monster attacks every 2s
    // Monster would hit at 2s, 4s, 6s, 8s = 4 hits, but kill happens at 9s so no hit at 10s
    const result = calcCombatRound(makeStats({ atk: 10 }), makeMonster({ hp: 30, def: 0, attackSpeed: 2 }));
    // monsterHitsPerKill = max(0, ceil(9/2) - 1) = max(0, 5-1) = 4
    expect(result.monsterHitsPerKill).toBe(4);
  });

  it("damagePerKill = monsterHitsPerKill * monsterDmg", () => {
    const result = calcCombatRound(makeStats({ atk: 10, def: 0 }), makeMonster({ hp: 30, def: 0, atk: 5, attackSpeed: 2 }));
    expect(result.damagePerKill).toBe(result.monsterHitsPerKill * 5);
  });
});

describe("simulateCombat", () => {
  it("kills monsters until time runs out", () => {
    const stats = makeStats({ hp: 1000, atk: 30 });
    const monster = makeMonster({ hp: 30, def: 0, atk: 1, attackSpeed: 3 });
    const result = simulateCombat(stats, monster, 60);
    expect(result.kills).toBeGreaterThan(0);
    expect(result.died).toBe(false);
    expect(result.timeUsed).toBeLessThanOrEqual(60);
  });

  it("player dies when hp reaches 0", () => {
    // Monster has huge HP so player can't kill it, but monster hits hard and fast
    const stats = makeStats({ hp: 10, atk: 1, def: 0 });
    const monster = makeMonster({ hp: 9999, def: 0, atk: 50, attackSpeed: 1 });
    const result = simulateCombat(stats, monster, 99999);
    expect(result.died).toBe(true);
    expect(result.kills).toBe(0);
    expect(result.hpRemaining).toBe(0);
  });

  it("returns 0 kills if time is too short for one kill", () => {
    const stats = makeStats({ atk: 1 });
    const monster = makeMonster({ hp: 100, def: 0 });
    // 100 hits * 3s = 300s to kill, but only 10s
    const result = simulateCombat(stats, monster, 10);
    expect(result.kills).toBe(0);
    expect(result.died).toBe(false);
  });

  it("hp remaining decreases after each kill", () => {
    // High HP so player survives, weak monster so kills happen
    const stats = makeStats({ hp: 5000, atk: 30, def: 0 });
    const monster = makeMonster({ hp: 30, def: 0, atk: 5, attackSpeed: 2 });
    const result = simulateCombat(stats, monster, 60);
    expect(result.kills).toBeGreaterThan(0);
    expect(result.hpRemaining).toBeLessThan(5000);
    expect(result.hpRemaining).toBeGreaterThan(0);
  });

  it("exact time boundary: time equals one kill duration", () => {
    const stats = makeStats({ hp: 1000, atk: 10 });
    const monster = makeMonster({ hp: 10, def: 0, atk: 1, attackSpeed: 10 });
    const round = calcCombatRound(stats, monster);
    const result = simulateCombat(stats, monster, round.timePerKill);
    expect(result.kills).toBe(1);
  });
});
