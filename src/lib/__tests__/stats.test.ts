import { describe, it, expect } from "vitest";
import { computeStats, computeStatsBreakdown, BASE_STATS } from "../stats";

describe("computeStats", () => {
  it("returns base stats at level 1 with no equipment", () => {
    const stats = computeStats({ bodyLevel: 1, equipment: {} });
    expect(stats.hp).toBe(BASE_STATS.hp);
    expect(stats.atk).toBe(BASE_STATS.atk);
    expect(stats.def).toBe(BASE_STATS.def);
  });

  it("realm bonus increases with body level", () => {
    const lv1 = computeStats({ bodyLevel: 1, equipment: {} });
    const lv10 = computeStats({ bodyLevel: 10, equipment: {} });
    expect(lv10.hp).toBeGreaterThan(lv1.hp);
    expect(lv10.atk).toBeGreaterThan(lv1.atk);
    expect(lv10.def).toBeGreaterThan(lv1.def);
  });

  it("realm bonus formula: (level - 1) * multiplier", () => {
    const stats = computeStats({ bodyLevel: 11, equipment: {} });
    // level 11 => 10 levels of bonus
    expect(stats.hp).toBe(BASE_STATS.hp + 10 * 10);  // +100 hp
    expect(stats.atk).toBe(BASE_STATS.atk + 10);      // +10 atk
    expect(stats.def).toBe(BASE_STATS.def + 10);       // +10 def
  });

  it("equipment adds stats correctly", () => {
    const stats = computeStats({
      bodyLevel: 1,
      equipment: { "main-hand": "poor_sword" }, // atk: 10
    });
    expect(stats.atk).toBe(BASE_STATS.atk + 10);
  });

  it("multiple equipment pieces stack", () => {
    const stats = computeStats({
      bodyLevel: 1,
      equipment: {
        "main-hand": "poor_sword",  // atk: 10
        "off-hand": "poor_shield",  // def: 10
        "helmet": "poor_helmet",    // hp: 10
      },
    });
    expect(stats.atk).toBe(BASE_STATS.atk + 10);
    expect(stats.def).toBe(BASE_STATS.def + 10);
    expect(stats.hp).toBe(BASE_STATS.hp + 10);
  });

  it("realm + equipment stack together", () => {
    const stats = computeStats({
      bodyLevel: 5, // 4 levels of bonus = +4 atk
      equipment: { "main-hand": "poor_sword" }, // +10 atk
    });
    expect(stats.atk).toBe(BASE_STATS.atk + 4 + 10);
  });

  it("unknown equipment item is safely ignored", () => {
    const stats = computeStats({
      bodyLevel: 1,
      equipment: { "helmet": "nonexistent_item" },
    });
    expect(stats.hp).toBe(BASE_STATS.hp);
  });
});

describe("computeStatsBreakdown", () => {
  it("base + realm + equipment = total", () => {
    const breakdown = computeStatsBreakdown({
      bodyLevel: 5,
      equipment: { "main-hand": "poor_sword" },
    });
    expect(breakdown.total.atk).toBe(
      breakdown.base.atk + breakdown.realm.atk + breakdown.equipment.atk
    );
    expect(breakdown.total.hp).toBe(
      breakdown.base.hp + breakdown.realm.hp + breakdown.equipment.hp
    );
    expect(breakdown.total.def).toBe(
      breakdown.base.def + breakdown.realm.def + breakdown.equipment.def
    );
  });

  it("base matches BASE_STATS constant", () => {
    const breakdown = computeStatsBreakdown({ bodyLevel: 1, equipment: {} });
    expect(breakdown.base.hp).toBe(BASE_STATS.hp);
    expect(breakdown.base.atk).toBe(BASE_STATS.atk);
  });
});
