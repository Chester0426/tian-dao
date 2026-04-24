// Smithing system constants — recipes, enhancement table, fuel values

// === Fuel ===
export const FUELS = [
  { item: "coal", heatZh: "煤", heatEn: "Coal", heat: 100, icon: "◆" },
  { item: "spirit_stone_fragment", heatZh: "靈石碎片", heatEn: "Spirit Stone Fragment", heat: 300, icon: "✦" },
  { item: "low_spirit_stone", heatZh: "下品靈石", heatEn: "Low Spirit Stone", heat: 800, icon: "✧" },
] as const;

export const MAX_HEAT = 1000;

// === Smelting Recipes ===
export interface SmeltingRecipe {
  id: string;
  output: string;
  nameZh: string;
  nameEn: string;
  level: number;
  materials: { item: string; qty: number }[];
  heat: number;
  time: number; // seconds
  xp: number;
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { id: "copper_bar", output: "copper_bar", nameZh: "銅錠", nameEn: "Copper Bar", level: 1, materials: [{ item: "copper_ore", qty: 1 }], heat: 50, time: 5, xp: 10 },
  { id: "bronze_bar", output: "bronze_bar", nameZh: "青銅錠", nameEn: "Bronze Bar", level: 25, materials: [{ item: "copper_ore", qty: 1 }, { item: "tin_ore", qty: 1 }], heat: 80, time: 8, xp: 25 },
  { id: "iron_bar", output: "iron_bar", nameZh: "鐵錠", nameEn: "Iron Bar", level: 50, materials: [{ item: "iron_ore", qty: 1 }], heat: 150, time: 10, xp: 50 },
  { id: "silver_bar", output: "silver_bar", nameZh: "銀錠", nameEn: "Silver Bar", level: 75, materials: [{ item: "silver_ore", qty: 1 }], heat: 250, time: 12, xp: 85 },
];

// === Forging Recipes ===
export interface ForgingRecipe {
  id: string;
  output: string;
  nameZh: string;
  nameEn: string;
  level: number;
  materials: { item: string; qty: number }[];
  heat: number;
  time: number;
  xp: number;
  slot: string;
  stats: { atk?: number; def?: number; hp?: number };
}

export type MaterialTier = "copper" | "bronze" | "iron" | "silver";

export const MATERIAL_TIERS: { key: MaterialTier; nameZh: string; nameEn: string; minLevel: number; bar: string }[] = [
  { key: "copper", nameZh: "銅裝", nameEn: "Copper", minLevel: 1, bar: "copper_bar" },
  { key: "bronze", nameZh: "青銅裝", nameEn: "Bronze", minLevel: 25, bar: "bronze_bar" },
  { key: "iron", nameZh: "鐵裝", nameEn: "Iron", minLevel: 50, bar: "iron_bar" },
  { key: "silver", nameZh: "銀裝", nameEn: "Silver", minLevel: 75, bar: "silver_bar" },
];

// Copper equipment recipes (base tier)
export const COPPER_FORGING: ForgingRecipe[] = [
  { id: "copper_sword", output: "copper_sword", nameZh: "銅劍", nameEn: "Copper Sword", level: 1, materials: [{ item: "copper_bar", qty: 3 }], heat: 60, time: 8, xp: 15, slot: "main-hand", stats: { atk: 5 } },
  { id: "copper_shield", output: "copper_shield", nameZh: "銅盾", nameEn: "Copper Shield", level: 3, materials: [{ item: "copper_bar", qty: 3 }], heat: 60, time: 8, xp: 15, slot: "off-hand", stats: { def: 5, hp: 10 } },
  { id: "copper_helmet", output: "copper_helmet", nameZh: "銅頭盔", nameEn: "Copper Helmet", level: 5, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "helmet", stats: { def: 3, hp: 5 } },
  { id: "copper_shoulder", output: "copper_shoulder", nameZh: "銅肩甲", nameEn: "Copper Shoulder", level: 6, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "shoulder", stats: { def: 3 } },
  { id: "copper_chest", output: "copper_chest", nameZh: "銅胸甲", nameEn: "Copper Chestplate", level: 8, materials: [{ item: "copper_bar", qty: 5 }], heat: 100, time: 10, xp: 20, slot: "chest", stats: { def: 5, hp: 20 } },
  { id: "copper_pants", output: "copper_pants", nameZh: "銅護腿", nameEn: "Copper Pants", level: 10, materials: [{ item: "copper_bar", qty: 4 }], heat: 80, time: 8, xp: 18, slot: "pants", stats: { def: 4, hp: 10 } },
  { id: "copper_gloves", output: "copper_gloves", nameZh: "銅手套", nameEn: "Copper Gloves", level: 12, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "gloves", stats: { atk: 2, def: 2 } },
  { id: "copper_boots", output: "copper_boots", nameZh: "銅靴子", nameEn: "Copper Boots", level: 14, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "boots", stats: { def: 3 } },
  { id: "copper_necklace", output: "copper_necklace", nameZh: "銅項鍊", nameEn: "Copper Necklace", level: 16, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "necklace", stats: { hp: 15 } },
  { id: "copper_cape", output: "copper_cape", nameZh: "銅披風", nameEn: "Copper Cape", level: 18, materials: [{ item: "copper_bar", qty: 3 }], heat: 60, time: 8, xp: 15, slot: "cape", stats: { def: 4 } },
  { id: "copper_ring", output: "copper_ring", nameZh: "銅戒指", nameEn: "Copper Ring", level: 20, materials: [{ item: "copper_bar", qty: 1 }], heat: 20, time: 5, xp: 10, slot: "ring", stats: { atk: 3 } },
  { id: "copper_accessory", output: "copper_accessory", nameZh: "銅飾品", nameEn: "Copper Accessory", level: 22, materials: [{ item: "copper_bar", qty: 2 }], heat: 40, time: 6, xp: 12, slot: "accessory", stats: { hp: 10 } },
];

// All forging recipes by tier
export const FORGING_RECIPES: Record<MaterialTier, ForgingRecipe[]> = {
  copper: COPPER_FORGING,
  bronze: [], // TODO: add when ready
  iron: [],
  silver: [],
};

// === Enhancement Table ===
export interface EnhancementLevel {
  level: number; // target level (+1, +2, ...)
  rate: number; // success rate 0-100
  barCost: number; // same-tier bars needed
  silverCost: number;
  heatCost: number;
  failResult: "consume" | "downgrade" | "downgrade_break";
  breakChance?: number; // only for downgrade_break, 0-100
}

export const ENHANCEMENT_TABLE: EnhancementLevel[] = [
  { level: 1, rate: 95, barCost: 1, silverCost: 10, heatCost: 50, failResult: "consume" },
  { level: 2, rate: 90, barCost: 1, silverCost: 20, heatCost: 50, failResult: "consume" },
  { level: 3, rate: 85, barCost: 2, silverCost: 40, heatCost: 50, failResult: "consume" },
  { level: 4, rate: 80, barCost: 2, silverCost: 80, heatCost: 50, failResult: "consume" },
  { level: 5, rate: 75, barCost: 3, silverCost: 150, heatCost: 50, failResult: "consume" },
  { level: 6, rate: 65, barCost: 3, silverCost: 300, heatCost: 100, failResult: "downgrade" },
  { level: 7, rate: 55, barCost: 4, silverCost: 500, heatCost: 100, failResult: "downgrade" },
  { level: 8, rate: 45, barCost: 5, silverCost: 800, heatCost: 100, failResult: "downgrade" },
  { level: 9, rate: 35, barCost: 6, silverCost: 1200, heatCost: 100, failResult: "downgrade" },
  { level: 10, rate: 25, barCost: 8, silverCost: 2000, heatCost: 100, failResult: "downgrade" },
  { level: 11, rate: 15, barCost: 10, silverCost: 3500, heatCost: 200, failResult: "downgrade_break", breakChance: 10 },
  { level: 12, rate: 10, barCost: 12, silverCost: 5000, heatCost: 200, failResult: "downgrade_break", breakChance: 20 },
  { level: 13, rate: 7, barCost: 15, silverCost: 8000, heatCost: 200, failResult: "downgrade_break", breakChance: 30 },
  { level: 14, rate: 5, barCost: 18, silverCost: 12000, heatCost: 200, failResult: "downgrade_break", breakChance: 40 },
  { level: 15, rate: 3, barCost: 22, silverCost: 18000, heatCost: 200, failResult: "downgrade_break", breakChance: 50 },
];

// Get the bar type for an equipment item
export function getEquipmentBarType(itemType: string): string | null {
  if (itemType.startsWith("copper_")) return "copper_bar";
  if (itemType.startsWith("bronze_")) return "bronze_bar";
  if (itemType.startsWith("iron_")) return "iron_bar";
  if (itemType.startsWith("silver_")) return "silver_bar";
  // Legacy items (poor_*)
  return "copper_bar";
}

// Slot display names
export const SLOT_DISPLAY: Record<string, { zh: string; en: string }> = {
  "main-hand": { zh: "主手", en: "Main Hand" },
  "off-hand": { zh: "副手", en: "Off Hand" },
  "helmet": { zh: "頭盔", en: "Helmet" },
  "shoulder": { zh: "護肩", en: "Shoulder" },
  "chest": { zh: "胸甲", en: "Chest" },
  "gloves": { zh: "手套", en: "Gloves" },
  "pants": { zh: "褲子", en: "Pants" },
  "boots": { zh: "靴子", en: "Boots" },
  "necklace": { zh: "項鍊", en: "Necklace" },
  "cape": { zh: "披風", en: "Cape" },
  "ring": { zh: "戒指", en: "Ring" },
  "accessory": { zh: "飾品", en: "Accessory" },
};
