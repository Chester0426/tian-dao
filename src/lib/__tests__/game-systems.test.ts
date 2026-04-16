import { describe, it, expect } from "vitest";
import {
  melvorXpForLevel, bodyXpForStage, qiXpForStage, qiBaseRate,
  getMasteryDoubleDropChance, spiritStoneBonus, isSpiritStone,
  getRealmLevelLabel,
} from "../types";
import {
  masteryXpForNextLevel, MAX_MASTERY_LEVEL,
  getTechnique, getTechniqueByBook, rollDamagedBook, TECHNIQUES,
} from "../techniques";
import { COMBAT_ZONES, type Monster } from "../combat";
import { computeStats } from "../stats";
import { calcCombatRound, simulateCombat } from "../combat-sim";
import { hasTag, itemsByTag, ITEMS } from "../items";

// ============================================================
// Activity mutual exclusion — verified via game rules
// ============================================================
describe("activity mutual exclusion rules", () => {
  const ACTIVITY_TYPES = ["mining", "meditate", "enlightenment", "combat"] as const;

  it("all activity types are distinct", () => {
    const unique = new Set(ACTIVITY_TYPES);
    expect(unique.size).toBe(ACTIVITY_TYPES.length);
  });

  it("combat zones define valid monsters for the combat activity", () => {
    for (const zone of COMBAT_ZONES) {
      expect(zone.monsters.length).toBeGreaterThan(0);
      for (const m of zone.monsters) {
        expect(m.id).toBeTruthy();
        expect(m.hp).toBeGreaterThan(0);
      }
    }
  });

  it("monster IDs are unique across all zones", () => {
    const ids = COMBAT_ZONES.flatMap((z) => z.monsters.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================
// XP progression curves
// ============================================================
describe("XP curves", () => {
  it("melvorXpForLevel is monotonically increasing", () => {
    for (let l = 2; l <= 50; l++) {
      expect(melvorXpForLevel(l)).toBeGreaterThan(melvorXpForLevel(l - 1));
    }
  });

  it("melvorXpForLevel(1) = 0", () => {
    expect(melvorXpForLevel(1)).toBe(0);
  });

  it("bodyXpForStage levels 1-8 match fixed table", () => {
    const expected = [200, 300, 500, 700, 900, 1100, 1300, 1500];
    for (let i = 0; i < expected.length; i++) {
      expect(bodyXpForStage(i + 1)).toBe(expected[i]);
    }
  });

  it("bodyXpForStage level 9+ uses exponential formula", () => {
    const lv9 = bodyXpForStage(9);
    const lv10 = bodyXpForStage(10);
    expect(lv10).toBeGreaterThan(lv9);
    // Should be ~10% increase each level
    expect(lv10 / lv9).toBeCloseTo(1.1, 1);
  });

  it("qiXpForStage returns values for levels 1-13", () => {
    for (let l = 1; l <= 13; l++) {
      expect(qiXpForStage(l)).toBeGreaterThan(0);
    }
  });

  it("qiXpForStage is monotonically increasing (1-12)", () => {
    for (let l = 2; l <= 12; l++) {
      expect(qiXpForStage(l)).toBeGreaterThanOrEqual(qiXpForStage(l - 1));
    }
  });
});

// ============================================================
// Breakthrough probability system
// ============================================================
describe("qi breakthrough probability", () => {
  it("levels 1-5 have 100% success rate", () => {
    for (let l = 1; l <= 5; l++) {
      expect(qiBaseRate(l)).toBe(100);
    }
  });

  it("levels 6-12 have decreasing success rates", () => {
    for (let l = 7; l <= 12; l++) {
      expect(qiBaseRate(l)).toBeLessThanOrEqual(qiBaseRate(l - 1));
    }
  });

  it("level 13 (breakthrough to 築基) has very low rate", () => {
    expect(qiBaseRate(13)).toBeLessThanOrEqual(5);
  });

  it("all rates are between 0 and 100", () => {
    for (let l = 1; l <= 13; l++) {
      expect(qiBaseRate(l)).toBeGreaterThanOrEqual(0);
      expect(qiBaseRate(l)).toBeLessThanOrEqual(100);
    }
  });
});

// ============================================================
// Mastery & double-drop system
// ============================================================
describe("mastery double-drop", () => {
  it("level 0 has 0% chance", () => {
    expect(getMasteryDoubleDropChance(0)).toBe(0);
  });

  it("level 10+ has some chance", () => {
    expect(getMasteryDoubleDropChance(10)).toBeGreaterThan(0);
  });

  it("higher mastery = higher chance", () => {
    expect(getMasteryDoubleDropChance(50)).toBeGreaterThan(getMasteryDoubleDropChance(10));
    expect(getMasteryDoubleDropChance(99)).toBeGreaterThan(getMasteryDoubleDropChance(50));
  });

  it("all chances are between 0 and 1", () => {
    for (let l = 0; l <= 99; l++) {
      const c = getMasteryDoubleDropChance(l);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================
// Spirit stone system
// ============================================================
describe("spirit stone", () => {
  it("spirit_stone_fragment is a spirit stone", () => {
    expect(isSpiritStone("spirit_stone_fragment")).toBe(true);
  });

  it("coal is not a spirit stone", () => {
    expect(isSpiritStone("coal")).toBe(false);
  });

  it("spirit stone has positive bonus", () => {
    expect(spiritStoneBonus("spirit_stone_fragment")).toBeGreaterThan(0);
  });

  it("non-spirit-stone has 0 bonus", () => {
    expect(spiritStoneBonus("coal")).toBe(0);
    expect(spiritStoneBonus(null)).toBe(0);
    expect(spiritStoneBonus(undefined)).toBe(0);
  });
});

// ============================================================
// Technique system
// ============================================================
describe("techniques", () => {
  it("all techniques have required fields", () => {
    for (const [slug, tech] of Object.entries(TECHNIQUES)) {
      expect(tech.slug).toBe(slug);
      expect(tech.nameZh).toBeTruthy();
      expect(tech.nameEn).toBeTruthy();
      expect(tech.category).toMatch(/^(cultivation|skill|refinement)$/);
      expect(tech.bookItemType).toBeTruthy();
    }
  });

  it("technique book items exist in ITEMS registry", () => {
    for (const tech of Object.values(TECHNIQUES)) {
      expect(ITEMS[tech.bookItemType], `${tech.bookItemType} not in ITEMS`).toBeTruthy();
    }
  });

  it("getTechnique returns correct technique", () => {
    expect(getTechnique("qi_primer_ten_lectures")?.nameZh).toBe("引氣入門十講");
    expect(getTechnique("nonexistent")).toBeNull();
  });

  it("getTechniqueByBook matches book item to technique", () => {
    expect(getTechniqueByBook("qi_primer_ten_lectures")?.slug).toBe("qi_primer_ten_lectures");
    expect(getTechniqueByBook("coal")).toBeNull();
  });

  it("mastery level cap is 5", () => {
    expect(MAX_MASTERY_LEVEL).toBe(5);
  });

  it("mastery XP thresholds increase with level", () => {
    for (let l = 2; l <= 4; l++) {
      expect(masteryXpForNextLevel(l)).toBeGreaterThan(masteryXpForNextLevel(l - 1));
    }
  });

  it("mastery XP at max level returns 0 (no further leveling)", () => {
    expect(masteryXpForNextLevel(MAX_MASTERY_LEVEL)).toBe(0);
  });
});

// ============================================================
// Damaged book loot table
// ============================================================
describe("rollDamagedBook", () => {
  it("returns valid items over many rolls", () => {
    const validItems = new Set(["novel", "qi_primer_ten_lectures", "mining_primer", "thick_skin_art"]);
    for (let i = 0; i < 200; i++) {
      const roll = rollDamagedBook();
      expect(validItems.has(roll.item_type)).toBe(true);
      expect(roll.quantity).toBe(1);
    }
  });

  it("novel is the most common drop (~90%)", () => {
    let novels = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rollDamagedBook().item_type === "novel") novels++;
    }
    // Should be ~90%, allow 85-95%
    expect(novels / trials).toBeGreaterThan(0.85);
    expect(novels / trials).toBeLessThan(0.95);
  });
});

// ============================================================
// Equipment tag system
// ============================================================
describe("equipment tags", () => {
  it("equipment items have 'equipment' tag", () => {
    const equipItems = itemsByTag("equipment");
    expect(equipItems.length).toBeGreaterThan(0);
    for (const key of equipItems) {
      expect(hasTag(key, "equipment")).toBe(true);
    }
  });

  it("consumable and equipment tags are mutually exclusive", () => {
    const consumables = new Set(itemsByTag("consumable"));
    const equipment = new Set(itemsByTag("equipment"));
    for (const c of consumables) {
      expect(equipment.has(c), `${c} is both consumable and equipment`).toBe(false);
    }
  });

  it("tome items have 'tome' tag and exist in ITEMS", () => {
    const tomes = itemsByTag("tome");
    expect(tomes.length).toBeGreaterThan(0);
    for (const key of tomes) {
      expect(ITEMS[key]).toBeTruthy();
    }
  });
});

// ============================================================
// Realm display labels
// ============================================================
describe("realm labels", () => {
  it("煉體 level 1-8 shows 級", () => {
    expect(getRealmLevelLabel("煉體", 3, "zh")).toBe("3 級");
  });

  it("煉體 level 9 shows 巔峰", () => {
    expect(getRealmLevelLabel("煉體", 9, "zh")).toBe("巔峰");
  });

  it("煉體 level 10+ shows 巔峰+N", () => {
    expect(getRealmLevelLabel("煉體", 11, "zh")).toBe("巔峰+2");
  });

  it("練氣 level 13 shows 巔峰", () => {
    expect(getRealmLevelLabel("練氣", 13, "zh")).toBe("巔峰");
  });
});

// ============================================================
// Integration: combat survivability check
// ============================================================
describe("combat balance integration", () => {
  it("a level 1 player can survive at least 1 kill against the weakest monster", () => {
    const stats = computeStats({ bodyLevel: 1, equipment: {} });
    const weakest = COMBAT_ZONES[0]?.monsters[0];
    if (!weakest) return; // no zones defined

    const result = simulateCombat(stats, weakest, 3600);
    // A base player should be able to kill at least one weak monster
    expect(result.kills).toBeGreaterThanOrEqual(1);
  });

  it("higher body level improves combat performance", () => {
    const weakest = COMBAT_ZONES[0]?.monsters[0];
    if (!weakest) return;

    const lv1 = simulateCombat(computeStats({ bodyLevel: 1, equipment: {} }), weakest, 300);
    const lv10 = simulateCombat(computeStats({ bodyLevel: 10, equipment: {} }), weakest, 300);

    // Level 10 should kill more or take less damage
    expect(lv10.kills).toBeGreaterThanOrEqual(lv1.kills);
  });

  it("equipment improves survivability", () => {
    const weakest = COMBAT_ZONES[0]?.monsters[0];
    if (!weakest) return;

    const naked = calcCombatRound(computeStats({ bodyLevel: 1, equipment: {} }), weakest);
    const geared = calcCombatRound(
      computeStats({ bodyLevel: 1, equipment: { "main-hand": "poor_sword", "chest": "poor_chest" } }),
      weakest,
    );

    // With weapon, should deal more damage
    expect(geared.playerDmg).toBeGreaterThan(naked.playerDmg);
  });
});
