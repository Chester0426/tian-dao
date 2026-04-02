"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VariantContent } from "@/lib/variants";
import { trackVisitLanding } from "@/lib/events";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

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

const ROADMAP = [
  {
    titleZh: "刪檔測試",
    titleEn: "Closed Beta (Wipe)",
    descZh: "",
    descEn: "",
    status: "active" as const,
  },
  {
    titleZh: "完善遊戲核心系統",
    titleEn: "Core Game Systems",
    descZh: "挖礦、境界、戰鬥、功法、符文、更多核心玩法...",
    descEn: "Mining, realms, combat, techniques, runes, more core mechanics...",
    status: "upcoming" as const,
  },
  {
    titleZh: "鏈上整合",
    titleEn: "On-chain Integration",
    descZh: "物品上鏈、交易市場",
    descEn: "On-chain items, trading marketplace",
    status: "upcoming" as const,
  },
  {
    titleZh: "公開測試",
    titleEn: "Open Beta",
    descZh: "",
    descEn: "",
    status: "upcoming" as const,
  },
  {
    titleZh: "上架 iOS & Android",
    titleEn: "Launch on iOS & Android",
    descZh: "",
    descEn: "",
    status: "upcoming" as const,
  },
  {
    titleZh: "上架 Steam",
    titleEn: "Launch on Steam",
    descZh: "",
    descEn: "",
    status: "upcoming" as const,
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
    <div className="relative snap-y snap-mandatory h-screen overflow-y-auto overflow-x-hidden scroll-smooth">
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

        <div
          className="relative z-10 flex max-w-3xl flex-col items-center text-center"
          style={{
            opacity: heroReveal.revealed ? 1 : 0,
            transform: heroReveal.revealed ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <img
            src="/images/logo-dao.png"
            alt="天道"
            className="mb-6 h-20 w-20 rounded-xl drop-shadow-[0_0_30px_rgba(200,160,100,0.4)]"
          />

          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
            {variant.headline}
          </h1>

          <div
            className="my-5 h-px w-48 md:w-64"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.7), transparent)",
            }}
          />

          <p className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
            {variant.subheadline}
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button
                className="seal-glow h-12 px-8 text-base font-bold transition-all duration-200 hover:scale-[1.03]"
                size="lg"
              >
                {variant.cta}
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-xs">{isZh ? "往下滑動" : "Scroll down"}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

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

      {/* === SECTION 4: ROADMAP === */}
      <section
        ref={roadmapReveal.ref}
        className="relative snap-start flex min-h-screen flex-col items-center justify-center px-6 py-20 md:px-12"
      >
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="relative z-10 max-w-3xl w-full"
          style={{
            opacity: roadmapReveal.revealed ? 1 : 0,
            transform: roadmapReveal.revealed ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <h2 className="text-center font-heading text-3xl font-bold text-white md:text-4xl">
            {isZh ? "路線圖" : "Roadmap"}
          </h2>
          <div
            className="mx-auto mt-3 h-px w-20"
            style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.5), transparent)" }}
          />

          <div className="relative mt-12">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10" />

            <div className="space-y-8">
              {ROADMAP.map((r, i) => (
                <div
                  key={i}
                  className="relative flex gap-5 pl-2"
                  style={{
                    opacity: roadmapReveal.revealed ? 1 : 0,
                    transform: roadmapReveal.revealed ? "translateX(0)" : "translateX(-20px)",
                    transition: `all 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.15 * (i + 1)}s`,
                  }}
                >
                  {/* Dot */}
                  <div className={`relative z-10 mt-1 flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border-2 ${
                    r.status === "active"
                      ? "border-spirit-gold bg-spirit-gold/30"
                      : "border-white/20 bg-black"
                  }`}>
                    {r.status === "active" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-spirit-gold animate-pulse" />
                    )}
                  </div>

                  <div className="pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-lg font-bold text-white/90">
                        {isZh ? r.titleZh : r.titleEn}
                      </h3>
                      {r.status === "active" && (
                        <span className="rounded-full bg-spirit-gold/15 px-2 py-0.5 text-[10px] font-medium text-spirit-gold">
                          {isZh ? "進行中" : "In Progress"}
                        </span>
                      )}
                    </div>
                    {(isZh ? r.descZh : r.descEn) && (
                      <p className="mt-1 text-sm text-white/50">
                        {isZh ? r.descZh : r.descEn}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link href="/signup">
              <Button
                className="seal-glow h-12 px-8 text-base font-bold transition-all duration-200 hover:scale-[1.03]"
                size="lg"
              >
                {variant.cta}
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 py-6 text-center">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} Tian Dao.
          </p>
        </div>
      </section>
    </div>
  );
}
