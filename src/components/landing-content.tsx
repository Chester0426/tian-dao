"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VariantContent } from "@/lib/variants";
import { trackVisitLanding } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ==========================================================================
   Xian Idle Landing Page (仙途放置)
   Ink wash cultivation aesthetic -- dark-first, cinnabar CTAs, jade qi accents
   ========================================================================== */

// ---------------------------------------------------------------------------
// Scroll-triggered animation hook
// Uses transform (scale, translateY) -- never opacity:0 as initial state
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Animated counter for social proof numbers
// ---------------------------------------------------------------------------
function AnimatedCounter({
  end,
  suffix = "",
  duration = 2000,
  revealed,
}: {
  end: number;
  suffix?: string;
  duration?: number;
  revealed: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!revealed) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [revealed, end, duration]);

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feature data (shared across variants, from experiment.yaml behaviors)
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "掛機挖礦",
    subtitle: "Idle Mining",
    description: "每 3 秒自動採集一次，煤、銅礦、靈石碎片隨機掉落。關掉瀏覽器也能累積最多 24 小時獎勵。",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth={1.5}>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "練體突破",
    subtitle: "Body Tempering",
    description: "挖礦累積修煉經驗，突破練體九階。每階提升屬性，九階後解鎖練體技能樹（1-99 級）。",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "精通加成",
    subtitle: "Mastery Bonuses",
    description: "每座礦脈獨立精通等級，精通越高雙倍掉落機率越大。99 級精通 = 15% 雙倍機率。",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth={1.5}>
        <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "鏈上資產",
    subtitle: "On-Chain Assets",
    description: "基於 EVM 的 ERC-1155 代幣。你的靈石碎片、裝備未來可在任何 NFT 市場自由交易。",
  },
];

// ---------------------------------------------------------------------------
// Floating ink particles (CSS-only decorative layer)
// ---------------------------------------------------------------------------
function InkParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${4 + i * 2}px`,
            height: `${4 + i * 2}px`,
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            background: `var(--ink-${(i % 5) + 1})`,
            opacity: 0.12 + (i % 3) * 0.05,
            animation: `float-particle ${6 + i * 1.5}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main landing content component
// ---------------------------------------------------------------------------
export default function LandingContent({
  variant,
}: {
  variant: VariantContent;
}) {
  const heroReveal = useScrollReveal(0.1);
  const painReveal = useScrollReveal(0.15);
  const featuresReveal = useScrollReveal(0.1);
  const proofReveal = useScrollReveal(0.1);
  const ctaReveal = useScrollReveal(0.1);

  // Fire visit_landing on mount
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Keyframe animations are in globals.css (ink-fade-in, seal-stamp, float-particle, etc.) */}

      {/* ================================================================
          SECTION 1: HERO
          Mist gradient bg + ink noise + floating particles
          Layout: Full-width, centered, cinematic
          ================================================================ */}
      <section
        ref={heroReveal.ref}
        className="ink-noise mist-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-24 pt-16 md:px-12 lg:px-16"
      >
        <InkParticles />

        {/* Decorative mist bands */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute left-0 top-[60%] h-32 w-full"
            style={{
              background: "linear-gradient(90deg, transparent, var(--jade-dim), transparent)",
              opacity: 0.3,
              animation: "mist-drift 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute left-0 top-[75%] h-24 w-full"
            style={{
              background: "linear-gradient(90deg, transparent, var(--ink-5), transparent)",
              opacity: 0.2,
              animation: "mist-drift 16s ease-in-out infinite reverse",
            }}
          />
        </div>

        <div
          className="relative z-10 flex max-w-4xl flex-col items-center text-center"
          style={{
            transform: heroReveal.revealed ? "translateY(0)" : "translateY(24px)",
            filter: heroReveal.revealed ? "blur(0)" : "blur(2px)",
            transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Badge */}
          <Badge
            variant="outline"
            className="mb-8 border-jade/30 bg-jade-dim px-4 py-1.5 text-sm font-medium text-jade"
          >
            <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-jade" />
            修仙放置 RPG
          </Badge>

          {/* Headline */}
          <h1
            className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: "0.1s" }}
          >
            {variant.headline}
          </h1>

          {/* Decorative brush stroke divider */}
          <div
            className="my-6 h-px w-48 md:w-64"
            style={{
              background: "linear-gradient(90deg, transparent, var(--cinnabar), transparent)",
              animation: heroReveal.revealed ? "brush-reveal 1.2s ease-out 0.4s both" : "none",
            }}
          />

          {/* Subheadline */}
          <p
            className="max-w-2xl text-lg leading-relaxed text-ink-3 md:text-xl"
            style={{
              transform: heroReveal.revealed ? "translateY(0)" : "translateY(16px)",
              filter: heroReveal.revealed ? "blur(0)" : "blur(1px)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, filter 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
            }}
          >
            {variant.subheadline}
          </p>

          {/* Promise line */}
          <p
            className="mt-3 text-sm font-medium tracking-wide text-spirit-gold text-glow-gold"
            style={{
              transform: heroReveal.revealed ? "translateY(0)" : "translateY(12px)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.35s",
            }}
          >
            {variant.promise}
          </p>

          {/* CTA */}
          <div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            style={{
              transform: heroReveal.revealed ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.45s",
            }}
          >
            <Link href="/signup">
              <Button
                className="seal-glow h-12 px-8 text-base font-bold transition-all duration-200 hover:scale-[1.03] hover:brightness-110"
                size="lg"
              >
                {variant.cta}
              </Button>
            </Link>
            <span className="text-sm text-ink-3">
              免費開始，無需信用卡
            </span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2" aria-hidden="true">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-ink-4">向下滾動</span>
            <div className="h-8 w-px bg-gradient-to-b from-ink-4 to-transparent" />
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2: PAIN POINTS
          Layout: 3-column asymmetric grid with cinnabar accents
          Depth: scroll-surface cards + cinnabar left border
          ================================================================ */}
      <section
        ref={painReveal.ref}
        className="ink-wash-bg ink-noise relative px-6 py-24 md:px-12 md:py-32 lg:px-16"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
              修仙路上的三座大山
            </h2>
            <p className="mt-3 text-ink-3">
              現有遊戲的問題，正是我們解決的起點。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {variant.painPoints.map((pain, i) => (
              <div
                key={i}
                className="scroll-surface relative rounded-lg border-l-2 border-l-cinnabar p-6"
                style={{
                  transform: painReveal.revealed
                    ? "translateY(0) scale(1)"
                    : "translateY(20px) scale(0.98)",
                  transition: `transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.12}s`,
                }}
              >
                {/* Pain icon: X mark in cinnabar */}
                <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-cinnabar-dim">
                  <svg viewBox="0 0 24 24" className="size-5 text-cinnabar" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-base font-medium leading-relaxed text-foreground">
                  {pain}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3: FEATURES
          Layout: 2x2 grid (desktop), stacked (mobile), alternating icon positions
          Depth: jade qi-glow on hover, glassmorphism cards
          ================================================================ */}
      <section
        ref={featuresReveal.ref}
        className="relative px-6 py-24 md:px-12 md:py-32 lg:px-16"
      >
        {/* Subtle jade radial in background */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 70% 50%, var(--jade-dim), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
              四大核心玩法
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-3">
              掛機即修煉，每一秒都在變強。
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="group scroll-surface relative rounded-xl p-8 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  transform: featuresReveal.revealed
                    ? "translateY(0) scale(1)"
                    : "translateY(24px) scale(0.97)",
                  transition: `transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${0.08 + i * 0.1}s`,
                }}
              >
                {/* Jade glow on hover */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: "inset 0 1px 0 var(--jade-dim), 0 0 30px var(--jade-dim)",
                  }}
                />

                <div className="relative z-10">
                  {/* Icon + title row */}
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-jade-dim text-jade transition-colors group-hover:bg-jade/20">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-heading text-xl font-bold text-foreground">
                        {feature.title}
                      </h3>
                      <span className="text-xs font-medium tracking-wider text-ink-4 uppercase">
                        {feature.subtitle}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-3">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4: SOCIAL PROOF / METRICS
          Layout: Full-width horizontal band, 3 stat counters
          Depth: sticky-feel dark band with gold shimmer counters
          ================================================================ */}
      <section
        ref={proofReveal.ref}
        className="relative overflow-hidden border-y border-border/50 px-6 py-20 md:px-12 lg:px-16"
        style={{
          background: "linear-gradient(135deg, var(--xuan-dark) 0%, var(--card) 50%, var(--xuan-dark) 100%)",
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-12 md:flex-row md:justify-between">
          {[
            { value: 24, suffix: "h", label: "最大離線累積時長" },
            { value: 9, suffix: "階", label: "練體突破境界" },
            { value: 3, suffix: "s", label: "每次採集間隔" },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center"
              style={{
                transform: proofReveal.revealed ? "translateY(0) scale(1)" : "translateY(16px) scale(0.95)",
                transition: `transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.15}s`,
              }}
            >
              <span className="font-heading text-5xl font-bold text-spirit-gold text-glow-gold md:text-6xl">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} revealed={proofReveal.revealed} />
              </span>
              <span className="mt-2 text-sm text-ink-3">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Proof line */}
        <p className="mx-auto mt-12 max-w-md text-center text-sm text-ink-3">
          {variant.proof}
        </p>
      </section>

      {/* ================================================================
          SECTION 5: HOW IT WORKS (mini journey)
          Layout: Vertical timeline with alternating left/right on desktop
          Depth: gradient connecting line + numbered steps
          ================================================================ */}
      <section className="relative px-6 py-24 md:px-12 md:py-32 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-16 text-center font-heading text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
            三步開始修仙
          </h2>

          <div className="relative">
            {/* Vertical connecting line */}
            <div
              className="absolute left-6 top-0 h-full w-px md:left-1/2 md:-translate-x-1/2"
              style={{
                background: "linear-gradient(180deg, var(--cinnabar-dim), var(--jade-dim), var(--spirit-gold-dim))",
              }}
              aria-hidden="true"
            />

            {[
              {
                step: "1",
                title: "註冊帳號",
                desc: "用 Email 快速註冊，30 秒內進入修仙世界。",
                color: "cinnabar" as const,
              },
              {
                step: "2",
                title: "開始挖礦",
                desc: "選擇枯竭礦脈，點擊「開始採集」。每 3 秒自動獲取資源和經驗。",
                color: "jade" as const,
              },
              {
                step: "3",
                title: "掛機成長",
                desc: "關掉瀏覽器繼續累積。回來時領取離線獎勵，突破境界。",
                color: "spirit-gold" as const,
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative mb-12 flex items-start gap-6 last:mb-0 md:gap-12 ${
                  i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Step number */}
                <div
                  className={`relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 font-heading text-lg font-bold md:absolute md:left-1/2 md:-translate-x-1/2 ${
                    item.color === "cinnabar"
                      ? "border-cinnabar bg-cinnabar-dim text-cinnabar text-glow-cinnabar"
                      : item.color === "jade"
                      ? "border-jade bg-jade-dim text-jade text-glow-jade"
                      : "border-spirit-gold bg-spirit-gold-dim text-spirit-gold text-glow-gold"
                  }`}
                >
                  {item.step}
                </div>

                {/* Content */}
                <div
                  className={`flex-1 ${
                    i % 2 === 0 ? "md:pr-[calc(50%+2rem)] md:text-right" : "md:pl-[calc(50%+2rem)]"
                  }`}
                >
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6: FINAL CTA
          Layout: Centered cinematic block, cinnabar glow CTA
          Depth: mist gradient + seal stamp animation on CTA
          ================================================================ */}
      <section
        ref={ctaReveal.ref}
        className="ink-noise relative px-6 py-32 md:px-12 md:py-40 lg:px-16"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, var(--cinnabar-dim), transparent 60%), var(--background)",
        }}
      >
        <div
          className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center"
          style={{
            transform: ctaReveal.revealed ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
            transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
            {variant.urgency}
          </h2>
          <p className="mt-4 max-w-md text-lg text-ink-3">
            {variant.subheadline}
          </p>

          <Link href="/signup" className="mt-10">
            <Button
              className="seal-glow h-14 px-10 text-lg font-bold transition-all duration-200 hover:scale-[1.04] hover:brightness-110"
              size="lg"
              style={{
                transform: ctaReveal.revealed ? "scale(1) rotate(0deg)" : "scale(1.15) rotate(-3deg)",
                transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
              }}
            >
              {variant.cta}
            </Button>
          </Link>

          <p className="mt-6 text-xs text-ink-4">
            免費遊玩 &#183; 無 Gas 費用 &#183; 隨時開始
          </p>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          Minimal: brand + links
          ================================================================ */}
      <footer className="border-t border-border/50 px-6 py-8 text-center">
        <p className="font-heading text-sm text-ink-4">
          仙途放置 &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
