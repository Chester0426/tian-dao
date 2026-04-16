// Combat zone and monster definitions

export interface Monster {
  id: string;
  nameZh: string;
  nameEn: string;
  icon: string;
  image: string;
  hp: number;
  atk: number;
  def: number;
  attackSpeed: number; // seconds per attack
  bodyXp: number; // 煉體經驗 per kill
  drops: { item_type: string; quantity: number; rate: number }[]; // rate: 0-1, 1 = 100%
}

export interface CombatZone {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  realmZh: string;  // e.g. "煉體期 1-5 級"
  realmEn: string;
  monsters: Monster[];
}

export const COMBAT_ZONES: CombatZone[] = [
  {
    id: "archway",
    nameZh: "牌坊",
    nameEn: "Archway",
    descZh: "城鎮入口的牌坊\n常有醉漢和流氓出沒",
    descEn: "The town entrance archway\nFrequented by drunkards and thugs",
    realmZh: "煉體期",
    realmEn: "Body Refining",
    monsters: [
      {
        id: "drunkard",
        nameZh: "醉漢",
        nameEn: "Drunkard",
        icon: "🍺",
        image: "/images/monsters/monster-drunkard.png",
        hp: 50,
        atk: 1,
        def: 0,
        attackSpeed: 3,
        bodyXp: 5,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
      {
        id: "thug",
        nameZh: "流氓",
        nameEn: "Thug",
        icon: "🗡️",
        image: "/images/monsters/monster-thug.png.png",
        hp: 140,
        atk: 5,
        def: 4,
        attackSpeed: 3,
        bodyXp: 10,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
    ],
  },
  {
    id: "imperial-road",
    nameZh: "官道",
    nameEn: "Imperial Road",
    descZh: "連接城鎮的官道\n途中常有劫匪出沒",
    descEn: "The imperial road between towns\nBandits lurk along the way",
    realmZh: "煉體期",
    realmEn: "Body Refining",
    monsters: [
      {
        id: "bandit",
        nameZh: "劫匪",
        nameEn: "Bandit",
        icon: "🏴",
        image: "/images/monsters/monster-bandit.png",
        hp: 120,
        atk: 4,
        def: 2,
        attackSpeed: 3,
        bodyXp: 8,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
      {
        id: "bandit-leader",
        nameZh: "匪首",
        nameEn: "Bandit Leader",
        icon: "⚔️",
        image: "/images/monsters/monster-bandit-leader.png",
        hp: 200,
        atk: 8,
        def: 5,
        attackSpeed: 3,
        bodyXp: 20,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
    ],
  },
  {
    id: "mountain-camp",
    nameZh: "山寨",
    nameEn: "Mountain Camp",
    descZh: "盤踞山頭的賊窩\n實力不容小覷",
    descEn: "A bandit stronghold in the mountains\nNot to be underestimated",
    realmZh: "煉體期",
    realmEn: "Body Refining",
    monsters: [
      {
        id: "mountain-bandit",
        nameZh: "山賊",
        nameEn: "Mountain Bandit",
        icon: "🏔️",
        image: "/images/monsters/monster-mountain-bandit.png",
        hp: 180,
        atk: 7,
        def: 4,
        attackSpeed: 3,
        bodyXp: 15,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
      {
        id: "mountain-king",
        nameZh: "寨主",
        nameEn: "Mountain King",
        icon: "👑",
        image: "/images/monsters/monster-mountain-king.png",
        hp: 300,
        atk: 12,
        def: 8,
        attackSpeed: 3,
        bodyXp: 35,
        drops: [{ item_type: "damaged_book", quantity: 1, rate: 0.2 }],
      },
    ],
  },
];
