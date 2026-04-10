// Central item registry.
//
// Two-layer principle:
//  - Player-facing (name, icon, color, flavor) → drives UI presentation
//  - Dev/internal (tags) → drives backend filtering/logic, never shown to player
//
// Tags are INTERNAL categorization keys. Never display them.
// Only add tags explicitly confirmed by the user.

export type ItemTag =
  | "spirit_stone" // used by 聚靈陣 equipment filter
  | "book"         // books (enlightenment inputs: 破損書籍, 小說)
  | "tome";        // 典藏 (learnable technique items dropped from book enlightenment)

export interface ItemDef {
  // --- Player-facing ---
  nameZh: string;
  nameEn: string;
  icon: string;
  color: string;
  // Optional flavor/hint shown to players (not the tag itself)
  hintZh?: string;
  hintEn?: string;

  // --- Developer/internal ---
  tags: ItemTag[];
}

export const ITEMS: Record<string, ItemDef> = {
  coal: {
    nameZh: "煤",
    nameEn: "Coal",
    icon: "◆",
    color: "text-foreground",
    tags: [],
  },
  copper_ore: {
    nameZh: "銅礦",
    nameEn: "Copper Ore",
    icon: "◇",
    color: "text-jade",
    tags: [],
  },
  spirit_stone_fragment: {
    nameZh: "靈石碎片",
    nameEn: "Spirit Stone Fragment",
    icon: "✦",
    color: "text-spirit-gold",
    hintZh: "可用於修煉",
    hintEn: "Usable for cultivation",
    tags: ["spirit_stone"],
  },
  damaged_book: {
    nameZh: "破損書籍",
    nameEn: "Damaged Book",
    icon: "📖",
    color: "text-amber-400",
    hintZh: "可用於參悟",
    hintEn: "Usable for enlightenment",
    tags: ["book"],
  },
  novel: {
    nameZh: "小說",
    nameEn: "Novel",
    icon: "📕",
    color: "text-muted-foreground",
    tags: [],
  },
  qi_primer_ten_lectures: {
    nameZh: "引氣入門十講",
    nameEn: "Qi Primer: Ten Lectures",
    icon: "📗",
    color: "text-jade",
    hintZh: "功法類典藏",
    hintEn: "Tome: Cultivation",
    tags: ["tome"],
  },
  mining_primer: {
    nameZh: "挖礦入門指引",
    nameEn: "Mining Primer",
    icon: "📘",
    color: "text-blue-400",
    hintZh: "技能類典藏",
    hintEn: "Tome: Skill",
    tags: ["tome"],
  },
  thick_skin_art: {
    nameZh: "厚皮功",
    nameEn: "Thick Skin Art",
    icon: "📙",
    color: "text-orange-400",
    hintZh: "修煉類典藏",
    hintEn: "Tome: Refinement",
    tags: ["tome"],
  },
};

export function getItem(itemType: string): ItemDef | null {
  return ITEMS[itemType] ?? null;
}

export function hasTag(itemType: string, tag: ItemTag): boolean {
  return ITEMS[itemType]?.tags.includes(tag) ?? false;
}

export function itemsByTag(tag: ItemTag): string[] {
  return Object.keys(ITEMS).filter((k) => ITEMS[k].tags.includes(tag));
}
