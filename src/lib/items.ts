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
  | "tome"         // 典藏 (learnable technique items dropped from book enlightenment)
  | "equipment"    // equippable gear
  | "consumable";  // food/potion — heals HP when consumed

// Equipment slot IDs — must match EQUIPMENT_SLOTS in stats/page.tsx
export type EquipSlotId = "helmet" | "shoulder" | "cape" | "necklace" | "main-hand" | "off-hand" | "chest" | "gloves" | "pants" | "accessory" | "ring" | "boots";

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
  equipSlot?: EquipSlotId;
  // Equipment stats (only for equipment tag)
  equipStats?: { hp?: number; atk?: number; def?: number; mp?: number };
  requirementZh?: string;
  requirementEn?: string;
  // Consumable stats (only for consumable tag)
  healHp?: number;
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
  // === Consumables — 補品 ===
  dry_ration: {
    nameZh: "乾糧", nameEn: "Dry Ration", icon: "🍙", color: "text-amber-300",
    hintZh: "恢復 10 點生命", hintEn: "Restore 10 HP",
    tags: ["consumable"], healHp: 10,
  },
  flatbread: {
    nameZh: "大餅", nameEn: "Flatbread", icon: "🫓", color: "text-amber-300",
    hintZh: "恢復 15 點生命", hintEn: "Restore 15 HP",
    tags: ["consumable"], healHp: 15,
  },
  jerky: {
    nameZh: "肉脯", nameEn: "Jerky", icon: "🥩", color: "text-amber-300",
    hintZh: "恢復 20 點生命", hintEn: "Restore 20 HP",
    tags: ["consumable"], healHp: 20,
  },

  // === Equipment — 劣質 (Poor quality) ===
  poor_helmet: {
    nameZh: "劣質頭盔", nameEn: "Poor Helmet", icon: "🪖", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "helmet",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_shoulder: {
    nameZh: "劣質護肩", nameEn: "Poor Shoulder Pads", icon: "🛡️", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "shoulder",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_chest: {
    nameZh: "劣質胸甲", nameEn: "Poor Chestplate", icon: "👕", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "chest",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_pants: {
    nameZh: "劣質褲子", nameEn: "Poor Pants", icon: "👖", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "pants",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_gloves: {
    nameZh: "劣質手套", nameEn: "Poor Gloves", icon: "🧤", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "gloves",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_boots: {
    nameZh: "劣質靴子", nameEn: "Poor Boots", icon: "🥾", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "boots",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_sword: {
    nameZh: "劣質劍", nameEn: "Poor Sword", icon: "🗡️", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "main-hand",
    equipStats: { atk: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_shield: {
    nameZh: "劣質盾", nameEn: "Poor Shield", icon: "🛡️", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "off-hand",
    equipStats: { def: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_ring: {
    nameZh: "劣質戒指", nameEn: "Poor Ring", icon: "💍", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "ring",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_accessory: {
    nameZh: "劣質飾品", nameEn: "Poor Accessory", icon: "📿", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "accessory",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_cape: {
    nameZh: "劣質披風", nameEn: "Poor Cape", icon: "🧣", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "cape",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_necklace: {
    nameZh: "劣質項鍊", nameEn: "Poor Necklace", icon: "📿", color: "text-muted-foreground",
    tags: ["equipment"], equipSlot: "necklace",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
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

export function itemsForSlot(slotId: EquipSlotId): string[] {
  return Object.keys(ITEMS).filter((k) => ITEMS[k].equipSlot === slotId);
}
