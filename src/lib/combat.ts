// Combat zone and monster definitions

export interface Monster {
  id: string;
  nameZh: string;
  nameEn: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  attackSpeed: number; // seconds per attack
  bodyXp: number; // 煉體經驗 per kill
  drops: { item_type: string; quantity: number }[];
}

export interface CombatZone {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  monsters: Monster[];
}

export const COMBAT_ZONES: CombatZone[] = [
  {
    id: "archway",
    nameZh: "牌坊",
    nameEn: "Archway",
    descZh: "城鎮入口的牌坊,常有醉漢和流氓出沒",
    descEn: "The town entrance archway, frequented by drunkards and thugs",
    monsters: [
      {
        id: "drunkard",
        nameZh: "醉漢",
        nameEn: "Drunkard",
        icon: "🍺",
        hp: 50,
        atk: 1,
        def: 0,
        attackSpeed: 3,
        bodyXp: 5,
        drops: [{ item_type: "damaged_book", quantity: 1 }],
      },
      {
        id: "thug",
        nameZh: "流氓",
        nameEn: "Thug",
        icon: "🗡️",
        hp: 140,
        atk: 5,
        def: 4,
        attackSpeed: 3,
        bodyXp: 10,
        drops: [{ item_type: "damaged_book", quantity: 1 }],
      },
    ],
  },
];
