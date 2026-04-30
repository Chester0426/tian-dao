// Technique registry — central definition of all cultivation techniques.
// Players learn a technique by consuming its book from inventory; the technique
// then appears in the enlightenment page's technique grid and can be "studied"
// (enlightenment persistence) to increase mastery level.
//
// Each technique has mastery levels 1-5. Level is capped at MAX_MASTERY_LEVEL.
// Mastery XP thresholds per level are cumulative per-level (not cumulative total).

export type TechniqueCategory = "cultivation" | "skill" | "refinement";

export interface TechniqueDef {
  slug: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  category: TechniqueCategory;
  bookItemType: string;
}

export const MAX_MASTERY_LEVEL = 5;

// XP required to go from level N to N+1. Keys are current level (1 → 2 means MASTERY_THRESHOLDS[1]).
export const MASTERY_THRESHOLDS: Record<number, number> = {
  1: 100,
  2: 300,
  3: 800,
  4: 2000,
};

export function masteryXpForNextLevel(currentLevel: number): number {
  return MASTERY_THRESHOLDS[currentLevel] ?? 0;
}

export const TECHNIQUES: Record<string, TechniqueDef> = {
  qi_primer_ten_lectures: {
    slug: "qi_primer_ten_lectures",
    nameZh: "引氣入門十講",
    nameEn: "Qi Primer: Ten Lectures",
    descZh: "修煉類入門功法,提升冥想時的靈氣吸收效率",
    descEn: "Beginner cultivation technique that improves qi absorption during meditation",
    category: "cultivation",
    bookItemType: "qi_primer_ten_lectures",
  },
  mining_primer: {
    slug: "mining_primer",
    nameZh: "挖礦入門指引",
    nameEn: "Mining Primer",
    descZh: "技能類入門指引,提升挖礦時獲得的技能經驗",
    descEn: "Beginner skill guide that improves mining skill XP gain",
    category: "skill",
    bookItemType: "mining_primer",
  },
  thick_skin_art: {
    slug: "thick_skin_art",
    nameZh: "厚皮功",
    nameEn: "Thick Skin Art",
    descZh: "修煉類功法,提升肉身韌性與氣血",
    descEn: "Refinement technique that increases HP and body toughness",
    category: "refinement",
    bookItemType: "thick_skin_art",
  },
};

export function getTechnique(slug: string): TechniqueDef | null {
  return TECHNIQUES[slug] ?? null;
}

export function getTechniqueByBook(itemType: string): TechniqueDef | null {
  return Object.values(TECHNIQUES).find((t) => t.bookItemType === itemType) ?? null;
}

// Enlightenment session constants
export const ENLIGHTENMENT_TICK_MS = 5000;
export const ENLIGHTENMENT_TICK_XP = 10; // mastery xp per tick (technique study)
export const ENLIGHTENMENT_XP_PER_TICK = 10; // player enlightenment xp per tick
export const DAMAGED_BOOK_ENLIGHTENMENT_XP = 100; // awarded on each damaged_book tick completion

// Damaged book loot table (probabilities as floats)
// 90% novel, 10% special → (10% qi_primer / 50% mining_primer / 40% thick_skin_art)
export interface LootRoll {
  item_type: string;
  quantity: number;
}

export function rollDamagedBook(): LootRoll {
  const roll = Math.random();
  if (roll < 0.9) return { item_type: "novel", quantity: 1 };
  const sub = Math.random();
  if (sub < 0.1) return { item_type: "qi_primer_ten_lectures", quantity: 1 };
  if (sub < 0.6) return { item_type: "mining_primer", quantity: 1 };
  return { item_type: "thick_skin_art", quantity: 1 };
}
