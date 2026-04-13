"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { VariantContent } from "@/lib/variants";
import { trackVisitLanding } from "@/lib/events";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { QiParticles } from "@/components/qi-particles";

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

const DEV_LOG = [
  { date: "04/12", items: [
    { zh: "離線系統優化", en: "Offline system optimization" },
    { zh: "裝備欄系統", en: "Equipment panel system" },
    { zh: "參悟等級修復", en: "Enlightenment level fix" },
    { zh: "離線獎勵優化", en: "Offline rewards optimization" },
    { zh: "悟道台 UI 布局", en: "Dao Comprehension Altar UI layout" },
    { zh: "典藏系統", en: "Tome system" },
    { zh: "風險條文案優化", en: "Risk bar text optimization" },
    { zh: "靈氣粒子動畫", en: "Qi particle animations" },
    { zh: "framer-motion 動畫", en: "Framer-motion animations" },
    { zh: "Landing/註冊頁自訂背景", en: "Landing/signup custom backgrounds" },
    { zh: "角色卡可見度優化", en: "Character card visibility optimization" },
    { zh: "Vercel 自動部署", en: "Vercel auto-deployment" },
  ]},
  { date: "04/09", items: [
    { zh: "練氣突破機率修正", en: "Qi breakthrough probability fix" },
    { zh: "冥想系統套用挖礦框架", en: "Meditation adopts mining framework" },
    { zh: "聚靈陣即時同步", en: "Qi Array real-time sync" },
    { zh: "離線判定機制重構", en: "Offline detection overhaul" },
    { zh: "離線獎勵預載優化", en: "Offline rewards preload optimization" },
    { zh: "挖礦/冥想/參悟三方互斥", en: "Mining/meditation/enlightenment mutual exclusion" },
    { zh: "角色頁活動狀態顯示", en: "Character page activity status" },
    { zh: "參悟系統", en: "Enlightenment system" },
    { zh: "物品中央表與標籤系統", en: "Central item registry and tag system" },
    { zh: "功法系統", en: "Technique system" },
    { zh: "參悟頁面 UI 設計", en: "Enlightenment page UI design" },
    { zh: "首頁/角色頁翻譯修正", en: "Landing/character page i18n fixes" },
    { zh: "挖礦讀條動畫修復", en: "Mining progress bar animation fix" },
  ]},
  { date: "04/08", items: [
    { zh: "練氣期冥想系統", en: "Qi Condensation meditation system" },
    { zh: "聚靈陣裝填系統", en: "Qi Array equipment system" },
    { zh: "練氣突破機率系統", en: "Qi breakthrough probability system" },
    { zh: "風險條視覺化", en: "Risk bar visualization" },
    { zh: "技能底層交互優化", en: "Skill interaction layer optimization" },
    { zh: "底層框架優化(provider tick loop、批次 sync、sendBeacon、離線獎勵)", en: "Core framework (provider tick loop, batched sync, sendBeacon, offline rewards)" },
    { zh: "回報系統", en: "Feedback system" },
    { zh: "admin 回報管理頁", en: "Admin feedback management page" },
    { zh: "煉體隱藏鈕", en: "Body Refining collapse toggle" },
    { zh: "技能動態解鎖", en: "Dynamic skill unlocking" },
    { zh: "通知位置調整", en: "Notification position adjustment" },
  ]},
  { date: "04/07", items: [
    { zh: "全域 i18n 翻譯統一（境界、物品、經驗用詞）", en: "Global i18n unified (realms, items, XP terminology)" },
    { zh: "突破對話框、滾動通知、離線通知英文化", en: "Breakthrough dialog, notifications, offline rewards localized" },
    { zh: "煉體巔峰系統（進入練氣後自動連續突破）", en: "Body Refining Peak system (auto-breakthrough after entering Qi Condensation)" },
    { zh: "修煉進度顯示修正（巔峰系統）", en: "Cultivation progress display fix (peak system)" },
    { zh: "挖礦頁面 UI 優化（未解鎖卡片設計、3 列佈局、間距調整）", en: "Mining page UI overhaul (locked card design, 3-column layout, spacing)" },
    { zh: "新增 9 個礦脈到資料庫（Lv.10-90）", en: "Added 9 new mines to database (Lv.10-90)" },
    { zh: "Four.meme 黑客松提交準備", en: "Four.meme hackathon submission prep" },
  ]},
  { date: "04/05", items: [
    { zh: "突破動畫優化（盤坐剪影 + 金色填充特效）", en: "Breakthrough animation overhaul (meditation silhouette + golden fill effect)" },
    { zh: "境界系統（煉體→練氣轉換）", en: "Realm system (Body Refining → Qi Condensation transition)" },
    { zh: "練氣期板塊 + 煉體板塊保留", en: "Qi Condensation panel + Body Refining panel retained" },
    { zh: "累積成長 / 突破成長數據顯示", en: "Cumulative growth / breakthrough growth data display" },
    { zh: "fal.ai API 整合", en: "fal.ai API integration" },
    { zh: "主頁 scroll snap + 路線圖更新", en: "Landing page scroll snap + roadmap update" },
    { zh: "突破雙重觸發 bug 修復", en: "Fixed breakthrough double-trigger bug" },
  ]},
  { date: "04/03", items: [
    { zh: "新增境界系統（煉體期→練氣期→築基期→金丹期→元嬰期）", en: "Added realm system (Body Refining→Qi Condensation→Foundation Establishment→Golden Core→Nascent Soul)" },
    { zh: "數值頁面（主要屬性 + 次要屬性 + 裝備區）", en: "Stats page (main stats + secondary stats + equipment)" },
    { zh: "煉體巔峰機制（9級後可無限提升）", en: "Body Refining peak mechanic (infinite progression after Lv.9)" },
    { zh: "各境界獨立資料儲存", en: "Independent realm data storage" },
    { zh: "自定義煉體經驗表", en: "Custom Body Refining XP table" },
    { zh: "經驗溢出機制", en: "XP overflow mechanic" },
    { zh: "遷移至新 Supabase 專案", en: "Migrated to new Supabase project" },
    { zh: "API 安全驗證", en: "API security verification" },
    { zh: "修復帳號切換資料混淆 bug", en: "Fixed account switching data contamination bug" },
    { zh: "開發日誌頁面", en: "Dev log page" },
    { zh: "角色選擇頁面優化", en: "Character selection page improvements" },
    { zh: "全頁面中英文翻譯", en: "Full page Chinese/English translation" },
  ]},
  { date: "04/02", items: [
    { zh: "Phantom 錢包開發者登入", en: "Phantom wallet dev login" },
    { zh: "Landing page 全新設計", en: "Landing page redesign" },
    { zh: "登入註冊頁面重設計", en: "Login/signup redesign" },
    { zh: "中英文切換", en: "Chinese/English toggle" },
    { zh: "新增戰鬥頁面（遊歷、秘境）", en: "Combat pages (adventure, dungeon)" },
    { zh: "新增技能頁面（採藥、煉丹、烹飪、釣魚、煉器）", en: "Skill pages (herbalism, alchemy, cooking, fishing, smithing)" },
    { zh: "可收合式 sidebar", en: "Collapsible sidebar" },
  ]},
  { date: "04/01", items: [
    { zh: "離線獎勵對話框", en: "Offline rewards dialog" },
    { zh: "通知計數修正", en: "Notification count fix" },
  ]},
  { date: "03/31", items: [
    { zh: "創建開發日誌", en: "Created dev log" },
  ]},
];

const FEATURES = [
  {
    titleZh: "放置修煉",
    titleEn: "Idle Cultivation",
    descZh: "掛機也能成長，離線時自動挖礦、修煉，24 小時不停歇",
    descEn: "Grow even while AFK — auto-mine and cultivate offline, 24/7",
    color: "text-spirit-gold",
    borderColor: "hover:border-spirit-gold/30",
    bgColor: "bg-spirit-gold/10",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    titleZh: "多元技能",
    titleEn: "Diverse Skills",
    descZh: "挖礦、符文、戰鬥，更多技能持續開發中，每種技能都有獨立等級與專精系統",
    descEn: "Mining, runes, combat — more skills in development, each with independent levels and mastery",
    color: "text-jade",
    borderColor: "hover:border-jade/30",
    bgColor: "bg-jade/10",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    titleZh: "境界突破",
    titleEn: "Realm Breakthrough",
    descZh: "從煉體開始，逐步突破更高境界，解鎖全新玩法與稀有資源",
    descEn: "Start from body tempering, break through to higher realms, unlock new mechanics and rare resources",
    color: "text-cinnabar",
    borderColor: "hover:border-cinnabar/30",
    bgColor: "bg-cinnabar/10",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    titleZh: "獻祭系統",
    titleEn: "Sacrifice System",
    descZh: "將多餘物資獻祭給天道，獲得天道碎片（TTAO）",
    descEn: "Sacrifice surplus resources to Tian Dao, earn TTAO tokens",
    color: "text-purple-400",
    borderColor: "hover:border-purple-400/30",
    bgColor: "bg-purple-400/10",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v8m0 0l4-4m-4 4L8 6" />
        <path d="M4.93 10.93a10 10 0 1 0 14.14 0" />
      </svg>
    ),
  },
  {
    titleZh: "社區共同建設遊戲",
    titleEn: "Community-Driven",
    descZh: "遊戲發展由社區共同決定，你的聲音決定天道的未來",
    descEn: "Game development driven by the community — your voice shapes the future of Tian Dao",
    color: "text-blue-400",
    borderColor: "hover:border-blue-400/30",
    bgColor: "bg-blue-400/10",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const TOKEN_DISTRIBUTION = [
  { labelZh: "Pump Bonding Curve", labelEn: "Pump Bonding Curve", pct: 50, color: "bg-spirit-gold", descZh: "上架即全流通", descEn: "Fully circulating at launch" },
  { labelZh: "遊戲生態", labelEn: "Game Ecosystem", pct: 30, color: "bg-jade", descZh: "1 年線性解鎖，100% 屬於社區", descEn: "1-year linear unlock, 100% community-owned" },
  { labelZh: "團隊", labelEn: "Team", pct: 10, color: "bg-cinnabar", descZh: "1 年線性解鎖，公測後才可領取", descEn: "1-year linear unlock, starts after public beta" },
  { labelZh: "私募", labelEn: "Private Sale", pct: 10, color: "bg-white/50", descZh: "1 年線性解鎖，公測後才可領取", descEn: "1-year linear unlock, starts after public beta" },
];

const COMMITMENTS = [
  { zh: "交易手續費歸屬團隊，用於建設協議", en: "Trading fees go to team for protocol development" },
  { zh: "遊戲營收 100% 回饋代幣持有者", en: "100% of game revenue returned to token holders" },
  { zh: "保證至少開發遊戲主體 + 1 個 DLC", en: "Guaranteed: main game + at least 1 DLC" },
  { zh: "預計開發鏈遊版 + Steam 版本", en: "Planned: on-chain version + Steam release" },
  { zh: "遊戲生態部分保證 100% 屬於社區", en: "Ecosystem allocation 100% belongs to community" },
];

const ROADMAP_SECTIONS = [
  {
    labelZh: "已完成",
    labelEn: "Completed",
    status: "done" as const,
    items: [
      { zh: "遊戲網站架設", en: "Game website setup" },
    ],
  },
  {
    labelZh: "進行中",
    labelEn: "In Progress",
    status: "active" as const,
    items: [
      { zh: "Steam 上架 KYC", en: "Steam listing KYC" },
      { zh: "刪檔測試", en: "Closed beta (wipe)" },
      { zh: "開發挖礦、境界、戰鬥、功法、符文、更多核心玩法...", en: "Developing mining, realms, combat, techniques, runes, more core mechanics..." },
    ],
  },
  {
    labelZh: "核心目標",
    labelEn: "Core Goals",
    status: "upcoming" as const,
    items: [
      { zh: "公開測試", en: "Open beta" },
      { zh: "上架 Steam", en: "Launch on Steam" },
      { zh: "上架 iOS & Android", en: "Launch on iOS & Android" },
    ],
  },
];

export default function LandingContent({
  variant,
}: {
  variant: VariantContent;
}) {
  const { locale, setLocale } = useI18n();
  const heroReveal = useScrollReveal(0.1);
  const featuresReveal = useScrollReveal(0.1);
  const tokenReveal = useScrollReveal(0.1);
  const roadmapReveal = useScrollReveal(0.1);

  useEffect(() => {
    trackVisitLanding({
      variant: variant.slug,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utm_medium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
      gclid: new URLSearchParams(window.location.search).get("gclid") ?? undefined,
      click_id:
        new URLSearchParams(window.location.search).get("gclid") ??
        new URLSearchParams(window.location.search).get("twclid") ??
        new URLSearchParams(window.location.search).get("rdt_cid") ??
        undefined,
      utm_content: new URLSearchParams(window.location.search).get("utm_content") ?? undefined,
    });
  }, []);

  const isZh = locale === "zh";

  return (
    <div className="relative h-screen overflow-y-auto overflow-x-hidden snap-y snap-mandatory">
      {/* === FIXED NAV === */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3 bg-black/40 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/images/logo-dao.png" alt="天道" className="h-8 w-8 rounded-lg" />
          <span className="font-heading text-lg font-bold text-white/90">
            {isZh ? "天道" : "Tian Dao"}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Social */}
          <a
            href="https://x.com/TianTao0401"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white hover:bg-white/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/TianTaoxyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white hover:bg-white/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
          <a
            href="https://www.twitch.tv/chester0416"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white hover:bg-white/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
            </svg>
          </a>

          <div className="mx-1 h-4 w-px bg-white/10" />

          {/* Language */}
          <button
            onClick={() => setLocale(isZh ? "en" : "zh")}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/60 transition-colors hover:text-white hover:border-white/30"
          >
            {isZh ? "EN" : "中"}
          </button>
        </div>
      </nav>

      {/* === SECTION 1: HERO === */}
      <section
        ref={heroReveal.ref}
        className="relative snap-start flex h-screen flex-col items-center justify-center px-6 md:px-12"
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <QiParticles />

        <motion.div
          className="relative z-10 flex max-w-3xl flex-col items-center text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={heroReveal.revealed ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src="/images/logo-dao.png"
            alt="天道"
            className="mb-6 h-20 w-20 rounded-xl drop-shadow-[0_0_30px_rgba(200,160,100,0.4)]"
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={heroReveal.revealed ? { scale: 1, opacity: 1, rotate: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />

          <motion.h1
            className="font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={heroReveal.revealed ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          >
            {isZh ? variant.headline : (variant.headlineEn ?? variant.headline)}
          </motion.h1>

          <motion.div
            className="my-5 h-px w-48 md:w-64"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.7), transparent)",
            }}
            initial={{ scaleX: 0 }}
            animate={heroReveal.revealed ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
          />

          <motion.p
            className="max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{
              textShadow: "0 1px 8px rgba(0,0,0,0.6), 0 0 20px rgba(200,160,100,0.15)",
              color: "rgba(255,255,255,0.85)",
            }}
            initial={{ opacity: 0 }}
            animate={heroReveal.revealed ? { opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            {(isZh ? variant.subheadline : (variant.subheadlineEn ?? variant.subheadline))
              .split("").map((char, i) => (
                <motion.span
                  key={i}
                  style={{ display: "inline-block" }}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={heroReveal.revealed ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                  transition={{
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.55 + i * 0.035,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))
            }
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center gap-4 sm:flex-row"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={heroReveal.revealed ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 1 }}
          >
            <Link href="/signup">
              <span className="relative inline-block hover:scale-[1.03] transition-transform cursor-pointer" style={{ width: '240px' }}>
                <img src="/images/btn-bg7.png" alt="" className="w-full h-auto block" />
                <span className="absolute inset-0 flex items-center justify-end pr-10 font-heading font-bold text-base text-white">
                  {isZh ? variant.cta : (variant.ctaEn ?? variant.cta)}
                </span>
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-xs">{isZh ? "往下滑動" : "Scroll down"}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* === ROADMAP === */}
      <section
        ref={roadmapReveal.ref}
        className="relative snap-start flex h-screen flex-col border-t border-white/5"
      >
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 flex flex-col min-h-0 px-6 pt-20 pb-8 md:px-12">
          {/* Header */}
          <div className="shrink-0 mb-5">
            <h2 className="text-center font-heading text-2xl font-bold text-white md:text-3xl">
              {isZh ? "路線圖" : "Roadmap"}
            </h2>
            <div
              className="mx-auto mt-3 h-px w-16"
              style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.5), transparent)" }}
            />
          </div>

          {/* Scrollable card */}
          <div className="flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md overflow-y-auto">
            <div className="p-6 md:p-8">
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-spirit-gold/40 to-white/10" />

                <div className="space-y-8">
                  {ROADMAP_SECTIONS.map((section, si) => {
                    const colorMap = {
                      done: { dot: "bg-emerald-400 ring-emerald-500/50", label: "text-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" },
                      active: { dot: "bg-spirit-gold ring-spirit-gold/50", label: "text-spirit-gold", badge: "bg-spirit-gold/15 border-spirit-gold/20 text-spirit-gold" },
                      upcoming: { dot: "bg-white/30 ring-white/10", label: "text-white/50", badge: "bg-white/5 border-white/10 text-white/50" },
                    };
                    const c = colorMap[section.status];
                    return (
                      <div key={si}>
                        {/* Section label */}
                        <div
                          className="relative flex items-center gap-4 mb-4"
                          style={{
                            opacity: roadmapReveal.revealed ? 1 : 0,
                            transform: roadmapReveal.revealed ? "translateX(0)" : "translateX(-20px)",
                            transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.15 * (si + 1)}s`,
                          }}
                        >
                          <div className={`relative z-10 h-[10px] w-[10px] shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-transparent ${c.dot}`}>
                            {section.status === "active" && (
                              <div className="absolute inset-0 rounded-full bg-spirit-gold/20 animate-ping" />
                            )}
                          </div>
                          <span className={`font-heading text-sm font-bold uppercase tracking-wider ${c.label}`}>
                            {isZh ? section.labelZh : section.labelEn}
                          </span>
                        </div>
                        {/* Items */}
                        <div className="space-y-3 pl-[26px]">
                          {section.items.map((item, j) => (
                            <div
                              key={j}
                              className="text-sm leading-relaxed text-white/60"
                              style={{
                                opacity: roadmapReveal.revealed ? 1 : 0,
                                transform: roadmapReveal.revealed ? "translateX(0)" : "translateX(-10px)",
                                transition: `all 0.5s ease-out ${0.15 * (si + 1) + 0.1 * (j + 1)}s`,
                              }}
                            >
                              {isZh ? item.zh : item.en}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="shrink-0 mt-4 text-center text-xs text-white/20">
            &copy; {new Date().getFullYear()} Tian Tao.
          </p>
        </div>
      </section>

      {/* === DEV LOG === */}
      <section id="devlog" className="relative snap-start flex h-screen flex-col border-t border-white/5">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 flex flex-col min-h-0 px-6 pt-20 pb-8 md:px-12">
          {/* Header */}
          <div className="shrink-0 mb-5">
            <h2 className="text-center font-heading text-2xl font-bold text-white md:text-3xl">
              {isZh ? "開發日誌" : "Dev Log"}
            </h2>
            <div
              className="mx-auto mt-3 h-px w-16"
              style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.5), transparent)" }}
            />
          </div>

          {/* Scrollable card */}
          <div className="flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md overflow-y-auto">
            <div className="p-6 md:p-8 space-y-5">
              {DEV_LOG.map((entry, i) => (
                <div key={i} className="relative pl-4 border-l-2 border-spirit-gold/20">
                  <span className="text-xs font-mono font-medium text-spirit-gold/60 tracking-wider">
                    {entry.date}
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {entry.items.map((item, j) => (
                      <p key={j} className="text-sm leading-relaxed text-white/55">
                        {isZh ? item.zh : item.en}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="shrink-0 mt-4 text-center text-xs text-white/20">
            &copy; {new Date().getFullYear()} Tian Tao.
          </p>
        </div>
      </section>

      {false && <>
      {/* === SECTION 2: FEATURES + SCREENSHOTS === */}
      <section
        ref={featuresReveal.ref}
        className="relative snap-start flex min-h-screen flex-col items-center justify-center px-6 py-20 md:px-12"
      >
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="relative z-10 max-w-5xl w-full"
          style={{
            opacity: featuresReveal.revealed ? 1 : 0,
            transform: featuresReveal.revealed ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <h2 className="text-center font-heading text-3xl font-bold text-white md:text-4xl">
            {isZh ? "遊戲特色" : "Game Features"}
          </h2>
          <div
            className="mx-auto mt-3 h-px w-20"
            style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.5), transparent)" }}
          />

          <div className="mt-12 flex flex-col gap-4 max-w-2xl mx-auto">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-6 py-5 backdrop-blur-sm transition-all ${f.borderColor} hover:bg-white/[0.06]`}
                style={{
                  opacity: featuresReveal.revealed ? 1 : 0,
                  transform: featuresReveal.revealed ? "translateY(0)" : "translateY(20px)",
                  transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.12 * (i + 1)}s`,
                }}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${f.bgColor} ${f.color}`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className={`font-heading text-lg font-bold ${f.color}`}>
                    {isZh ? f.titleZh : f.titleEn}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/50">
                    {isZh ? f.descZh : f.descEn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === SECTION 3: TOKEN ECONOMY === */}
      <section
        ref={tokenReveal.ref}
        className="relative snap-start flex min-h-screen flex-col items-center justify-center px-6 py-20 md:px-12"
      >
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="relative z-10 max-w-4xl w-full"
          style={{
            opacity: tokenReveal.revealed ? 1 : 0,
            transform: tokenReveal.revealed ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <h2 className="text-center font-heading text-3xl font-bold text-white md:text-4xl">
            {isZh ? "代幣經濟" : "Tokenomics"}
          </h2>
          <div
            className="mx-auto mt-3 h-px w-20"
            style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.5), transparent)" }}
          />

          {/* Distribution bar */}
          <div className="mt-10">
            <div className="flex h-12 w-full overflow-hidden rounded-2xl border border-white/10">
              {TOKEN_DISTRIBUTION.map((t, i) => (
                <div
                  key={i}
                  className={`${t.color} relative flex items-center justify-center transition-all duration-1000`}
                  style={{
                    width: tokenReveal.revealed ? `${t.pct}%` : "0%",
                    transitionDelay: `${0.2 + i * 0.15}s`,
                  }}
                >
                  {t.pct >= 20 && (
                    <span className="text-xs font-bold text-black/70 drop-shadow-sm">
                      {t.pct}%
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {TOKEN_DISTRIBUTION.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  style={{
                    opacity: tokenReveal.revealed ? 1 : 0,
                    transform: tokenReveal.revealed ? "translateY(0)" : "translateY(10px)",
                    transition: `all 0.5s ease-out ${0.3 + i * 0.1}s`,
                  }}
                >
                  <div className={`mt-1 h-4 w-4 shrink-0 rounded-full ${t.color}`} />
                  <div>
                    <p className="text-sm font-bold text-white/90">
                      {t.pct}% — {isZh ? t.labelZh : t.labelEn}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {isZh ? t.descZh : t.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commitments */}
          <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.03] p-6">
            <h3 className="font-heading text-lg font-bold text-spirit-gold/80 mb-4">
              {isZh ? "團隊承諾" : "Our Commitments"}
            </h3>
            <ul className="space-y-3">
              {COMMITMENTS.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-white/60"
                  style={{
                    opacity: tokenReveal.revealed ? 1 : 0,
                    transition: `opacity 0.5s ease-out ${0.5 + i * 0.08}s`,
                  }}
                >
                  <span className="mt-0.5 text-spirit-gold/60">-</span>
                  <span>{isZh ? c.zh : c.en}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      </>}
    </div>
  );
}
