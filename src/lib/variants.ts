export const VARIANTS = ["cultivation", "earn"] as const;
export type Variant = (typeof VARIANTS)[number];
export const DEFAULT_VARIANT: Variant = "cultivation";

export function isValidVariant(slug: string): slug is Variant {
  return VARIANTS.includes(slug as Variant);
}

export interface VariantContent {
  slug: Variant;
  headline: string;
  subheadline: string;
  cta: string;
  promise: string;
  proof: string;
  urgency: string;
  painPoints: string[];
}

export const VARIANT_MAP: Record<Variant, VariantContent> = {
  cultivation: {
    slug: "cultivation",
    headline: "天道",
    subheadline:
      "每一絲靈氣的運轉皆由你敕令，每一份機緣的歸屬皆由你主宰。",
    cta: "開始修煉",
    promise: "掛機即修煉，離線也成長",
    proof: "基於 EVM — 你的物資真正屬於你",
    urgency: "修仙之路，始於今日",
    painPoints: [
      "鏈遊要一直盯著螢幕",
      "放置遊戲裡的物品不屬於你",
      "Web3 遊戲只是 DeFi 換皮",
    ],
  },
  earn: {
    slug: "earn",
    headline: "挖礦。修煉。鏈上交易。",
    subheadline: "修仙主題放置 RPG，你的努力化為鏈上資產。",
    cta: "踏入修仙界",
    promise: "時間投入轉化為鏈上資產",
    proof: "ERC-1155 物品可在任何 NFT 市場交易",
    urgency: "早期修士獲得最稀有的礦脈",
    painPoints: [
      "肝了半天什麼都帶不走",
      "NFT 遊戲根本沒有遊戲性",
      "Play-to-earn 像上班不像玩遊戲",
    ],
  },
};
