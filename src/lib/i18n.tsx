"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type Locale = "zh" | "en";

const translations = {
  zh: {
    // Sidebar
    sidebar_items: "物品",
    sidebar_realm: "境界",
    sidebar_skills: "技能",
    sidebar_shop: "商店",
    sidebar_inventory: "儲物袋",
    sidebar_bodyTempering: "煉體",
    sidebar_mining: "挖礦",
    sidebar_switchChar: "切換角色",
    sidebar_logout: "登出",

    // Shop
    shop_title: "商店",
    shop_subtitle: "使用天道碎片（TTAO）購買升級",
    shop_balance: "持有天道碎片:",
    shop_slotExpand: "儲物袋擴充",
    shop_slotDesc: "增加 1 格儲物袋空間",
    shop_currentSlots: "當前格數",
    shop_afterExpand: "擴充後",
    shop_price: "價格",
    shop_buying: "購買中...",
    shop_needMore: "需要 {n} 天道碎片",
    shop_buy: "購買",
    shop_moreItems: "更多商品",
    shop_comingSoon: "即將推出...",

    // Inventory
    inv_title: "儲物袋",
    inv_subtitle: "管理你的物資與資源",
    inv_slots: "格數",
    inv_items: "物品",
    inv_empty: "儲物袋空空如也",
    inv_goMining: "前往礦場開始採集資源",
    inv_sacrifice: "獻祭",
    inv_cancel: "取消",
    inv_sacrificeMode: "點選要獻祭的物品，再按下方確認",
    inv_selected: "已選",
    inv_clickSelect: "點擊選取",
    inv_clickDeselect: "點擊取消",
    inv_sacrificeList: "獻祭清單",
    inv_all: "全部",
    inv_daoPointsGain: "獲得天道值",
    inv_confirmSacrifice: "確認獻祭",
    inv_sacrificing: "獻祭中...",
    inv_daoPoints: "天道值",

    // Mining
    mining_title: "挖礦",
    mining_skillLevel: "技能等級",
    mining_skillXp: "技能經驗",
    mining_idleMsg: "你的挖礦行動資訊會顯示在此。",
    mining_locked: "未解鎖",
    mining_needLevel: "需要 Lv.{n}",
    mining_mastery: "專精",
    mining_startMining: "開始挖礦",
    mining_stopMining: "停止挖礦",
    mining_levelUp: "提升挖礦等級至 Lv.{n} 解鎖",
    mining_active: "挖礦中",

    // Dashboard
    dash_title: "修煉總覽",
    dash_subtitle: "修煉之路，永不停歇",
    dash_bodyXp: "煉體經驗",
    dash_canBreak: "可以突破了！",
    dash_breakthrough: "突破",
    dash_current: "當前",
    dash_notReached: "未達成",
    dash_miningSkill: "挖礦技能",
    dash_miningDesc: "挖礦等級與精通度",
    dash_goMining: "前往礦場",
    dash_startMastery: "開始挖礦以獲得精通度",

    // Notifications
    notif_miningXp: "挖礦經驗",
    notif_bodyXp: "煉體經驗",
    notif_miningLevelUp: "挖礦升級 Lv.{n}",
    notif_masteryLevelUp: "精通升級 Lv.{n}",

    // Offline rewards
    offline_title: "離線收益",
    offline_away: "你離開了",
    offline_hours: "小時",
    offline_minutes: "分鐘",
    offline_actions: "次",
    offline_activityRunning: "持續運行，共",
    offline_items: "獲得物品",
    offline_xpGained: "經驗獲得",
    offline_claim: "領取完畢",

    // Items
    item_coal: "煤",
    item_copperOre: "銅礦",
    item_spiritStone: "靈石碎片",

    // Characters
    char_title: "天道",
    char_subtitle: "選擇存檔開始修煉",
    char_save: "存檔",
    char_empty: "空存檔",
    char_create: "建立角色",
    char_creating: "建立中...",
    char_load: "載入",
    char_loading: "載入中...",
    char_locked: "未解鎖",
    char_lockedBtn: "即將開放",
    char_delete: "刪除角色",
    char_deleteConfirm: "確定要刪除存檔 {n} 的角色嗎？",
    char_deleteWarn: "此操作無法復原，所有進度將永久刪除。",
    char_deleteInput: "請輸入",
    char_deleteInputHint: "確認刪除",
    char_confirmDelete: "確認刪除",
    char_deleting: "刪除中...",
    char_connectWallet: "連接錢包",
    char_signBind: "簽名綁定此錢包",
    char_signing: "簽名中...",

    // Login
    login_welcome: "歡迎回來",
    login_subtitle: "登入繼續你的修仙之旅",
    login_email: "Email",
    login_password: "密碼",
    login_submit: "進入修仙界",
    login_logging: "登入中...",
    login_noAccount: "還沒有帳號？",
    login_signup: "註冊帳號",
    login_google: "使用 Google 登入",

    // Signup
    signup_title: "踏入修仙界",
    signup_google: "使用 Google 註冊",

    // Single tab
    singleTab_title: "遊戲已在其他視窗開啟",
    singleTab_msg: "天道僅允許同時開啟一個視窗。請關閉此頁面，或關閉另一個視窗後重新整理。",
    singleTab_refresh: "重新整理",

    // Common
    or: "或",
  },

  en: {
    // Sidebar
    sidebar_items: "Items",
    sidebar_realm: "Realm",
    sidebar_skills: "Skills",
    sidebar_shop: "Shop",
    sidebar_inventory: "Inventory",
    sidebar_bodyTempering: "Body Tempering",
    sidebar_mining: "Mining",
    sidebar_switchChar: "Switch Character",
    sidebar_logout: "Logout",

    // Shop
    shop_title: "Shop",
    shop_subtitle: "Purchase upgrades with TTAO tokens",
    shop_balance: "TTAO Balance:",
    shop_slotExpand: "Inventory Expansion",
    shop_slotDesc: "Add 1 inventory slot",
    shop_currentSlots: "Current Slots",
    shop_afterExpand: "After Expansion",
    shop_price: "Price",
    shop_buying: "Purchasing...",
    shop_needMore: "Need {n} more TTAO",
    shop_buy: "Purchase",
    shop_moreItems: "More Items",
    shop_comingSoon: "Coming soon...",

    // Inventory
    inv_title: "Inventory",
    inv_subtitle: "Manage your items and resources",
    inv_slots: "Slots",
    inv_items: "Items",
    inv_empty: "Inventory is empty",
    inv_goMining: "Go mining to collect resources",
    inv_sacrifice: "Sacrifice",
    inv_cancel: "Cancel",
    inv_sacrificeMode: "Select items to sacrifice, then confirm below",
    inv_selected: "Selected",
    inv_clickSelect: "Click to select",
    inv_clickDeselect: "Click to deselect",
    inv_sacrificeList: "Sacrifice List",
    inv_all: "All",
    inv_daoPointsGain: "Dao Points gained",
    inv_confirmSacrifice: "Confirm Sacrifice",
    inv_sacrificing: "Sacrificing...",
    inv_daoPoints: "Dao Points",

    // Mining
    mining_title: "Mining",
    mining_skillLevel: "Skill Level",
    mining_skillXp: "Skill XP",
    mining_idleMsg: "Your mining activity will appear here.",
    mining_locked: "Locked",
    mining_needLevel: "Requires Lv.{n}",
    mining_mastery: "Mastery",
    mining_startMining: "Start Mining",
    mining_stopMining: "Stop Mining",
    mining_levelUp: "Reach Mining Lv.{n} to unlock",
    mining_active: "Mining",

    // Dashboard
    dash_title: "Cultivation Overview",
    dash_subtitle: "The path of cultivation never stops",
    dash_bodyXp: "Body Tempering XP",
    dash_canBreak: "Ready to break through!",
    dash_breakthrough: "Break Through",
    dash_current: "Current",
    dash_notReached: "Not reached",
    dash_miningSkill: "Mining Skill",
    dash_miningDesc: "Mining level and mastery",
    dash_goMining: "Go to Mine",
    dash_startMastery: "Start mining to gain mastery",

    // Notifications
    notif_miningXp: "Mining XP",
    notif_bodyXp: "Body XP",
    notif_miningLevelUp: "Mining Level Up Lv.{n}",
    notif_masteryLevelUp: "Mastery Level Up Lv.{n}",

    // Offline rewards
    offline_title: "Offline Rewards",
    offline_away: "You were away for",
    offline_hours: "hours",
    offline_minutes: "minutes",
    offline_actions: "actions",
    offline_activityRunning: "continued running,",
    offline_items: "Items Gained",
    offline_xpGained: "XP Gained",
    offline_claim: "Claim All",

    // Items
    item_coal: "Coal",
    item_copperOre: "Copper Ore",
    item_spiritStone: "Spirit Stone Fragment",

    // Characters
    char_title: "Tian Dao",
    char_subtitle: "Select a save to begin cultivation",
    char_save: "Save",
    char_empty: "Empty Slot",
    char_create: "Create Character",
    char_creating: "Creating...",
    char_load: "Load",
    char_loading: "Loading...",
    char_locked: "Locked",
    char_lockedBtn: "Coming Soon",
    char_delete: "Delete Character",
    char_deleteConfirm: "Delete character in save slot {n}?",
    char_deleteWarn: "This action cannot be undone. All progress will be permanently deleted.",
    char_deleteInput: "Type",
    char_deleteInputHint: "to confirm deletion",
    char_confirmDelete: "Confirm Delete",
    char_deleting: "Deleting...",
    char_connectWallet: "Connect Wallet",
    char_signBind: "Sign to bind wallet",
    char_signing: "Signing...",

    // Login
    login_welcome: "Welcome Back",
    login_subtitle: "Sign in to continue your journey",
    login_email: "Email",
    login_password: "Password",
    login_submit: "Enter the Realm",
    login_logging: "Signing in...",
    login_noAccount: "Don't have an account?",
    login_signup: "Sign Up",
    login_google: "Sign in with Google",

    // Signup
    signup_title: "Enter the Realm",
    signup_google: "Sign up with Google",

    // Single tab
    singleTab_title: "Game already open",
    singleTab_msg: "Tian Dao only allows one window at a time. Close this page or close the other window and refresh.",
    singleTab_refresh: "Refresh",

    // Common
    or: "or",
  },
} as const;

type TranslationKey = keyof typeof translations.zh;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>(null!);

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("locale") as Locale) ?? "zh";
    }
    return "zh";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text: string = translations[locale][key] ?? translations.zh[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
