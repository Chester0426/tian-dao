import { describe, it, expect } from "vitest";
import { ITEMS, getItem, hasTag, itemsByTag, itemsForSlot } from "../items";

describe("item registry", () => {
  it("all items have required fields", () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      expect(item.nameZh, `${key} missing nameZh`).toBeTruthy();
      expect(item.nameEn, `${key} missing nameEn`).toBeTruthy();
      expect(item.icon, `${key} missing icon`).toBeTruthy();
      expect(item.color, `${key} missing color`).toBeTruthy();
      expect(Array.isArray(item.tags), `${key} tags not array`).toBe(true);
    }
  });

  it("getItem returns item for known type", () => {
    expect(getItem("coal")).not.toBeNull();
    expect(getItem("coal")!.nameEn).toBe("Coal");
  });

  it("getItem returns null for unknown type", () => {
    expect(getItem("nonexistent")).toBeNull();
  });

  it("hasTag checks correctly", () => {
    expect(hasTag("spirit_stone_fragment", "spirit_stone")).toBe(true);
    expect(hasTag("coal", "spirit_stone")).toBe(false);
    expect(hasTag("nonexistent", "spirit_stone")).toBe(false);
  });

  it("itemsByTag returns correct items", () => {
    const consumables = itemsByTag("consumable");
    expect(consumables).toContain("dry_ration");
    expect(consumables).toContain("flatbread");
    expect(consumables).toContain("jerky");
    expect(consumables).not.toContain("coal");
  });

  it("itemsForSlot returns equipment for slot", () => {
    const helmets = itemsForSlot("helmet");
    expect(helmets).toContain("poor_helmet");
    expect(helmets).not.toContain("poor_sword");
  });
});

describe("consumable items", () => {
  it("all consumables have healHp", () => {
    const consumables = itemsByTag("consumable");
    for (const key of consumables) {
      const item = getItem(key)!;
      expect(item.healHp, `${key} missing healHp`).toBeGreaterThan(0);
    }
  });

  it("healHp values are reasonable (1-100)", () => {
    const consumables = itemsByTag("consumable");
    for (const key of consumables) {
      const item = getItem(key)!;
      expect(item.healHp).toBeGreaterThanOrEqual(1);
      expect(item.healHp).toBeLessThanOrEqual(100);
    }
  });
});

describe("equipment items", () => {
  it("all equipment have equipSlot", () => {
    const equipment = itemsByTag("equipment");
    for (const key of equipment) {
      const item = getItem(key)!;
      expect(item.equipSlot, `${key} missing equipSlot`).toBeTruthy();
    }
  });

  it("all equipment have equipStats", () => {
    const equipment = itemsByTag("equipment");
    for (const key of equipment) {
      const item = getItem(key)!;
      expect(item.equipStats, `${key} missing equipStats`).toBeTruthy();
      const stats = item.equipStats!;
      const total = (stats.hp ?? 0) + (stats.atk ?? 0) + (stats.def ?? 0) + (stats.mp ?? 0);
      expect(total, `${key} equipStats all zero`).toBeGreaterThan(0);
    }
  });
});

describe("drop rates", () => {
  it("combat zones have valid drop rates (0-1)", async () => {
    const { COMBAT_ZONES } = await import("../combat");
    for (const zone of COMBAT_ZONES) {
      for (const monster of zone.monsters) {
        for (const drop of monster.drops) {
          expect(drop.rate, `${monster.id} -> ${drop.item_type} rate`).toBeGreaterThan(0);
          expect(drop.rate, `${monster.id} -> ${drop.item_type} rate`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("all drop item_types exist in ITEMS registry", async () => {
    const { COMBAT_ZONES } = await import("../combat");
    for (const zone of COMBAT_ZONES) {
      for (const monster of zone.monsters) {
        for (const drop of monster.drops) {
          expect(getItem(drop.item_type), `${drop.item_type} not in ITEMS`).not.toBeNull();
        }
      }
    }
  });

  it("monsters have positive hp, atk, bodyXp", async () => {
    const { COMBAT_ZONES } = await import("../combat");
    for (const zone of COMBAT_ZONES) {
      for (const monster of zone.monsters) {
        expect(monster.hp, `${monster.id} hp`).toBeGreaterThan(0);
        expect(monster.atk, `${monster.id} atk`).toBeGreaterThan(0);
        expect(monster.bodyXp, `${monster.id} bodyXp`).toBeGreaterThan(0);
        expect(monster.attackSpeed, `${monster.id} attackSpeed`).toBeGreaterThan(0);
      }
    }
  });
});
