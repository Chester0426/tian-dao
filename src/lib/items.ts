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
  | "consumable"   // food/potion — heals HP when consumed
  | "fuel"         // furnace fuel (coal, spirit stones)
  | "reagent"      // crafting reagent (bars, etc.)
  | "junk";        // junk items (novel, etc.)

// Equipment slot IDs — must match EQUIPMENT_SLOTS in stats/page.tsx
export type EquipSlotId = "helmet" | "shoulder" | "cape" | "necklace" | "main-hand" | "off-hand" | "chest" | "gloves" | "pants" | "accessory" | "ring" | "boots";

export interface ItemDef {
  // --- Player-facing ---
  nameZh: string;
  nameEn: string;
  icon: string;
  image?: string;
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
    image: "/images/items/coal.png",
    color: "text-foreground",
    hintZh: "常見的燃料礦石", hintEn: "A common fuel ore",
    tags: ["fuel"],
  },
  copper_ore: {
    nameZh: "銅礦",
    nameEn: "Copper Ore",
    icon: "◇",
    image: "/images/items/copper_ore.png",
    color: "text-jade",
    hintZh: "可用於煉器的基礎礦石", hintEn: "A basic ore used in smithing",
    tags: [],
  },
  tin_ore: {
    nameZh: "錫礦",
    nameEn: "Tin Ore",
    icon: "◈",
    image: "/images/items/tin_ore.png",
    color: "text-zinc-300",
    hintZh: "可用於製作青銅合金的礦石", hintEn: "An ore used for bronze alloys",
    tags: [],
  },
  iron_ore: {
    nameZh: "鐵礦",
    nameEn: "Iron Ore",
    icon: "◆",
    image: "/images/items/iron_ore.png",
    color: "text-slate-400",
    hintZh: "堅硬的中階礦石", hintEn: "A sturdy mid-tier ore",
    tags: [],
  },
  silver_ore: {
    nameZh: "銀礦",
    nameEn: "Silver Ore",
    icon: "◇",
    image: "/images/items/silver_ore.png",
    color: "text-gray-200",
    hintZh: "閃耀的高階礦石", hintEn: "A gleaming high-tier ore",
    tags: [],
  },
  spirit_stone_fragment: {
    nameZh: "靈石碎片",
    nameEn: "Spirit Stone Fragment",
    icon: "✦",
    image: "/images/items/spirit_stone_fragment.png",
    color: "text-spirit-gold",
    hintZh: "蘊含微弱靈氣的碎片", hintEn: "A fragment imbued with faint spiritual energy",
    tags: ["spirit_stone", "fuel"],
  },
  low_spirit_stone: {
    nameZh: "下品靈石",
    nameEn: "Low-grade Spirit Stone",
    icon: "✧",
    image: "/images/items/low_spirit_stone.png",
    color: "text-spirit-gold",
    hintZh: "凝聚靈氣的下品靈石，冥想效果更佳", hintEn: "A low-grade spirit stone with condensed energy",
    tags: ["spirit_stone", "fuel"],
  },
  // === Test fuel items (for 6-fuel grid preview) ===
  mid_spirit_stone: {
    nameZh: "中品靈石", nameEn: "Mid Spirit Stone", icon: "✦", color: "text-purple-400",
    hintZh: "蘊含中等靈氣的靈石", hintEn: "A spirit stone with moderate energy",
    tags: ["spirit_stone", "fuel"],
  },
  fire_crystal: {
    nameZh: "火晶", nameEn: "Fire Crystal", icon: "🔶", color: "text-orange-500",
    hintZh: "蘊含火焰精華的晶石", hintEn: "A crystal imbued with flame essence",
    tags: ["fuel"],
  },
  charcoal: {
    nameZh: "木炭", nameEn: "Charcoal", icon: "▪", color: "text-zinc-400",
    hintZh: "基礎的木製燃料", hintEn: "Basic wood fuel",
    tags: ["fuel"],
  },
  // === Bars (smelting output) ===
  copper_bar: {
    nameZh: "銅錠", nameEn: "Copper Bar", icon: "🟫", color: "text-amber-600",
    hintZh: "製作材料", hintEn: "Crafting Reagent",
    tags: ["reagent"],
  },
  bronze_bar: {
    nameZh: "青銅錠", nameEn: "Bronze Bar", icon: "🟤", color: "text-amber-700",
    hintZh: "製作材料", hintEn: "Crafting Reagent",
    tags: ["reagent"],
  },
  iron_bar: {
    nameZh: "鐵錠", nameEn: "Iron Bar", icon: "⬛", color: "text-slate-400",
    hintZh: "製作材料", hintEn: "Crafting Reagent",
    tags: ["reagent"],
  },
  silver_bar: {
    nameZh: "銀錠", nameEn: "Silver Bar", icon: "⬜", color: "text-gray-200",
    hintZh: "製作材料", hintEn: "Crafting Reagent",
    tags: ["reagent"],
  },
  // === Copper Equipment (smithing output) ===
  copper_sword: {
    nameZh: "銅劍", nameEn: "Copper Sword", icon: "🗡️", color: "text-amber-600",
    hintZh: "基礎的銅製武器", hintEn: "A basic copper weapon",
    tags: ["equipment"], equipSlot: "main-hand" as EquipSlotId,
    equipStats: { atk: 5 },
  },
  copper_shield: {
    nameZh: "銅盾", nameEn: "Copper Shield", icon: "🛡️", color: "text-amber-600",
    hintZh: "基礎的銅製盾牌", hintEn: "A basic copper shield",
    tags: ["equipment"], equipSlot: "off-hand" as EquipSlotId,
    equipStats: { def: 5, hp: 10 },
  },
  copper_helmet: {
    nameZh: "銅頭盔", nameEn: "Copper Helmet", icon: "🪖", color: "text-amber-600",
    hintZh: "基礎的銅製頭盔", hintEn: "A basic copper helmet",
    tags: ["equipment"], equipSlot: "helmet" as EquipSlotId,
    equipStats: { def: 3, hp: 5 },
  },
  copper_shoulder: {
    nameZh: "銅肩甲", nameEn: "Copper Shoulder", icon: "🛡️", color: "text-amber-600",
    hintZh: "基礎的銅製護肩", hintEn: "A basic copper shoulder pad",
    tags: ["equipment"], equipSlot: "shoulder" as EquipSlotId,
    equipStats: { def: 3 },
  },
  copper_chest: {
    nameZh: "銅胸甲", nameEn: "Copper Chestplate", icon: "👕", color: "text-amber-600",
    hintZh: "基礎的銅製胸甲", hintEn: "A basic copper chestplate",
    tags: ["equipment"], equipSlot: "chest" as EquipSlotId,
    equipStats: { def: 5, hp: 20 },
  },
  copper_pants: {
    nameZh: "銅護腿", nameEn: "Copper Pants", icon: "👖", color: "text-amber-600",
    hintZh: "基礎的銅製護腿", hintEn: "A basic copper leg armor",
    tags: ["equipment"], equipSlot: "pants" as EquipSlotId,
    equipStats: { def: 4, hp: 10 },
  },
  copper_gloves: {
    nameZh: "銅手套", nameEn: "Copper Gloves", icon: "🧤", color: "text-amber-600",
    hintZh: "基礎的銅製手套", hintEn: "A basic copper gloves",
    tags: ["equipment"], equipSlot: "gloves" as EquipSlotId,
    equipStats: { atk: 2, def: 2 },
  },
  copper_boots: {
    nameZh: "銅靴子", nameEn: "Copper Boots", icon: "🥾", color: "text-amber-600",
    hintZh: "基礎的銅製靴子", hintEn: "A basic copper boots",
    tags: ["equipment"], equipSlot: "boots" as EquipSlotId,
    equipStats: { def: 3 },
  },
  copper_necklace: {
    nameZh: "銅項鍊", nameEn: "Copper Necklace", icon: "📿", color: "text-amber-600",
    hintZh: "基礎的銅製項鍊", hintEn: "A basic copper necklace",
    tags: ["equipment"], equipSlot: "necklace" as EquipSlotId,
    equipStats: { hp: 15 },
  },
  copper_cape: {
    nameZh: "銅披風", nameEn: "Copper Cape", icon: "🧣", color: "text-amber-600",
    hintZh: "基礎的銅製披風", hintEn: "A basic copper cape",
    tags: ["equipment"], equipSlot: "cape" as EquipSlotId,
    equipStats: { def: 4 },
  },
  copper_ring: {
    nameZh: "銅戒指", nameEn: "Copper Ring", icon: "💍", color: "text-amber-600",
    hintZh: "基礎的銅製戒指", hintEn: "A basic copper ring",
    tags: ["equipment"], equipSlot: "ring" as EquipSlotId,
    equipStats: { atk: 3 },
  },
  copper_accessory: {
    nameZh: "銅飾品", nameEn: "Copper Accessory", icon: "📿", color: "text-amber-600",
    hintZh: "基礎的銅製飾品", hintEn: "A basic copper accessory",
    tags: ["equipment"], equipSlot: "accessory" as EquipSlotId,
    equipStats: { hp: 10 },
  },
  // === Books ===
  damaged_book: {
    nameZh: "破損書籍",
    nameEn: "Damaged Book",
    icon: "📖",
    image: "/images/items/damaged_book.png",
    color: "text-amber-400",
    hintZh: "表面看不出書名的書籍", hintEn: "A book with no visible title",
    tags: ["book"],
  },
  novel: {
    nameZh: "小說",
    nameEn: "Novel",
    icon: "📕",
    image: "/images/items/novel.png",
    color: "text-muted-foreground",
    hintZh: "凡人消遣的俗世讀物", hintEn: "Mundane reading for mortals",
    tags: ["junk"],
  },
  qi_primer_ten_lectures: {
    nameZh: "引氣入門十講",
    nameEn: "Qi Primer: Ten Lectures",
    icon: "📗",
    image: "/images/items/qi_primer_ten_lectures.png",
    color: "text-jade",
    hintZh: "功法類典藏",
    hintEn: "Tome: Cultivation",
    tags: ["tome"],
  },
  mining_primer: {
    nameZh: "挖礦入門指引",
    nameEn: "Mining Primer",
    icon: "📘",
    image: "/images/items/mining_primer.png",
    color: "text-blue-400",
    hintZh: "技能類典藏",
    hintEn: "Tome: Skill",
    tags: ["tome"],
  },
  thick_skin_art: {
    nameZh: "厚皮功",
    nameEn: "Thick Skin Art",
    icon: "📙",
    image: "/images/items/thick_skin_art.png",
    color: "text-orange-400",
    hintZh: "修煉類典藏",
    hintEn: "Tome: Refinement",
    tags: ["tome"],
  },
  // === Consumables — 補品 ===
  dry_ration: {
    nameZh: "乾糧", nameEn: "Dry Ration", icon: "🍙", image: "/images/items/dry_ration.png", color: "text-amber-300",
    hintZh: "乾燥食物", hintEn: "Simple dried food",
    tags: ["consumable"], healHp: 10,
  },
  flatbread: {
    nameZh: "大餅", nameEn: "Flatbread", icon: "🫓", image: "/images/items/flatbread.png", color: "text-amber-300",
    hintZh: "烤熟的麵餅", hintEn: "A baked flatbread",
    tags: ["consumable"], healHp: 15,
  },
  jerky: {
    nameZh: "肉脯", nameEn: "Jerky", icon: "🥩", image: "/images/items/jerky.png", color: "text-amber-300",
    hintZh: "風乾的肉條", hintEn: "Dried strips of meat",
    tags: ["consumable"], healHp: 20,
  },

  // === Equipment — 劣質 (Poor quality) ===
  poor_helmet: {
    nameZh: "劣質頭盔", nameEn: "Poor Helmet", icon: "🪖", image: "/images/items/poor_helmet.png", color: "text-muted-foreground",
    hintZh: "劣質的頭盔", hintEn: "A poor-quality helmet",
    tags: ["equipment"], equipSlot: "helmet",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_shoulder: {
    nameZh: "劣質護肩", nameEn: "Poor Shoulder Pads", icon: "🛡️", image: "/images/items/poor_shoulder.png", color: "text-muted-foreground",
    hintZh: "劣質的護肩", hintEn: "A poor-quality shoulder guard",
    tags: ["equipment"], equipSlot: "shoulder",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_chest: {
    nameZh: "劣質胸甲", nameEn: "Poor Chestplate", icon: "👕", image: "/images/items/poor_chest.png", color: "text-muted-foreground",
    hintZh: "劣質的胸甲", hintEn: "A poor-quality chestplate",
    tags: ["equipment"], equipSlot: "chest",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_pants: {
    nameZh: "劣質褲子", nameEn: "Poor Pants", icon: "👖", image: "/images/items/poor_pants.png", color: "text-muted-foreground",
    hintZh: "劣質的褲子", hintEn: "A poor-quality pants",
    tags: ["equipment"], equipSlot: "pants",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_gloves: {
    nameZh: "劣質手套", nameEn: "Poor Gloves", icon: "🧤", image: "/images/items/poor_gloves.png", color: "text-muted-foreground",
    hintZh: "劣質的手套", hintEn: "A poor-quality gloves",
    tags: ["equipment"], equipSlot: "gloves",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_boots: {
    nameZh: "劣質靴子", nameEn: "Poor Boots", icon: "🥾", image: "/images/items/poor_boots.png", color: "text-muted-foreground",
    hintZh: "劣質的靴子", hintEn: "A poor-quality boots",
    tags: ["equipment"], equipSlot: "boots",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_sword: {
    nameZh: "劣質劍", nameEn: "Poor Sword", icon: "🗡️", image: "/images/items/poor_sword.png", color: "text-muted-foreground",
    hintZh: "劣質的劍", hintEn: "A poor-quality sword",
    tags: ["equipment"], equipSlot: "main-hand",
    equipStats: { atk: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_shield: {
    nameZh: "劣質盾", nameEn: "Poor Shield", icon: "🛡️", image: "/images/items/poor_shield.png", color: "text-muted-foreground",
    hintZh: "劣質的盾", hintEn: "A poor-quality shield",
    tags: ["equipment"], equipSlot: "off-hand",
    equipStats: { def: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_ring: {
    nameZh: "劣質戒指", nameEn: "Poor Ring", icon: "💍", image: "/images/items/poor_ring.png", color: "text-muted-foreground",
    hintZh: "劣質的戒指", hintEn: "A poor-quality ring",
    tags: ["equipment"], equipSlot: "ring",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_accessory: {
    nameZh: "劣質飾品", nameEn: "Poor Accessory", icon: "📿", image: "/images/items/poor_accessory.png", color: "text-muted-foreground",
    hintZh: "劣質的飾品", hintEn: "A poor-quality trinket",
    tags: ["equipment"], equipSlot: "accessory",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_cape: {
    nameZh: "劣質披風", nameEn: "Poor Cape", icon: "🧣", image: "/images/items/poor_cape.png", color: "text-muted-foreground",
    hintZh: "劣質的披風", hintEn: "A poor-quality cloak",
    tags: ["equipment"], equipSlot: "cape",
    equipStats: { hp: 10 }, requirementZh: "煉體期 1 級", requirementEn: "Body Refining Lv.1",
  },
  poor_necklace: {
    nameZh: "劣質項鍊", nameEn: "Poor Necklace", icon: "📿", image: "/images/items/poor_necklace.png", color: "text-muted-foreground",
    hintZh: "劣質的項鍊", hintEn: "A poor-quality necklace",
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
