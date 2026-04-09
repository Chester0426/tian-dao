"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useGameState } from "@/components/mining-provider";
import { ITEMS, hasTag } from "@/lib/items";
import {
  TECHNIQUES,
  MAX_MASTERY_LEVEL,
  MASTERY_THRESHOLDS,
  ENLIGHTENMENT_TICK_MS,
  ENLIGHTENMENT_TICK_XP,
  DAMAGED_BOOK_ENLIGHTENMENT_XP,
  type TechniqueCategory,
} from "@/lib/techniques";

interface LearnedTechnique {
  technique_slug: string;
  mastery_level: number;
  mastery_xp: number;
}

interface Props {
  enlightenmentXp: number;
  enlightenmentLevel: number;
  learnedTechniques: LearnedTechnique[];
  inventory: { item_type: string; quantity: number }[];
}

type Target =
  | { kind: "book"; item_type: string }
  | { kind: "technique"; technique_slug: string };

const CATEGORY_LABELS: Record<TechniqueCategory, { zh: string; en: string; color: string; border: string; bg: string; accent: string }> = {
  cultivation: { zh: "功法類", en: "Cultivation", color: "text-jade", border: "border-jade/30", bg: "bg-jade/5", accent: "bg-jade" },
  skill: { zh: "技能類", en: "Skill", color: "text-blue-400", border: "border-blue-400/30", bg: "bg-blue-400/5", accent: "bg-blue-400" },
  refinement: { zh: "修煉類", en: "Refinement", color: "text-spirit-gold", border: "border-spirit-gold/30", bg: "bg-spirit-gold/5", accent: "bg-spirit-gold" },
};

/* Large ring radius for the workshop */
const RING_R = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

export function EnlightenmentClient({
  enlightenmentXp,
  enlightenmentLevel,
  learnedTechniques: initialLearned,
  inventory: initialInventory,
}: Props) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const router = useRouter();
  const gameState = useGameState();
  const inventory = gameState.inventory.length > 0 ? gameState.inventory : initialInventory;

  const [selectionOpen, setSelectionOpen] = useState(false);
  const [learning, setLearning] = useState<string | null>(null);
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [isEnlightening, setIsEnlightening] = useState(false);
  const [actionProgress, setActionProgress] = useState(0);
  const tickStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingTicksRef = useRef(0);

  const learnedMap = new Map(initialLearned.map((t) => [t.technique_slug, t]));
  const bookInventory = inventory.filter((i) => hasTag(i.item_type, "book") && i.quantity > 0);

  // RAF tick loop
  useEffect(() => {
    if (!isEnlightening || !currentTarget) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setActionProgress(0);
      return;
    }
    tickStartRef.current = Date.now();
    const loop = () => {
      const elapsed = Date.now() - tickStartRef.current;
      const p = Math.min(elapsed / ENLIGHTENMENT_TICK_MS, 1);
      setActionProgress(p);
      if (p >= 1) {
        pendingTicksRef.current += 1;
        gameState.addNotification(
          "📜",
          currentTarget.kind === "book"
            ? (isZh ? "參悟" : "Enlightenment")
            : (isZh ? TECHNIQUES[(currentTarget as { technique_slug: string }).technique_slug]?.nameZh ?? "功法" : "Technique"),
          currentTarget.kind === "book" ? DAMAGED_BOOK_ENLIGHTENMENT_XP : ENLIGHTENMENT_TICK_XP,
          "text-spirit-gold"
        );
        tickStartRef.current = Date.now();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnlightening, currentTarget]);

  // Batched sync every 30s
  useEffect(() => {
    if (!isEnlightening) return;
    const flush = () => {
      const ticks = pendingTicksRef.current;
      if (ticks <= 0) return;
      pendingTicksRef.current = 0;
      fetch("/api/game/enlightenment/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks }),
      }).then(() => router.refresh()).catch(() => {
        pendingTicksRef.current += ticks;
      });
    };
    const timer = setInterval(flush, 30000);
    return () => { flush(); clearInterval(timer); };
  }, [isEnlightening, router]);

  // BeforeUnload beacon
  useEffect(() => {
    const handler = () => {
      if (pendingTicksRef.current > 0) {
        navigator.sendBeacon(
          "/api/game/enlightenment/sync",
          JSON.stringify({ ticks: pendingTicksRef.current })
        );
        pendingTicksRef.current = 0;
      }
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  const learnBook = async (itemType: string) => {
    setLearning(itemType);
    try {
      const res = await fetch("/api/game/learn-technique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: itemType }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLearning(null);
    }
  };

  const startEnlightenment = async (target: Target) => {
    setCurrentTarget(target);
    setSelectionOpen(false);
    setIsEnlightening(true);
    pendingTicksRef.current = 0;
    await fetch("/api/game/enlightenment/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", target }),
      keepalive: true,
    });
  };

  const stopEnlightenment = async () => {
    if (pendingTicksRef.current > 0) {
      await fetch("/api/game/enlightenment/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks: pendingTicksRef.current }),
      }).catch(() => {});
      pendingTicksRef.current = 0;
    }
    setIsEnlightening(false);
    setCurrentTarget(null);
    await fetch("/api/game/enlightenment/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
      keepalive: true,
    });
    router.refresh();
  };

  const byCategory = { cultivation: [] as string[], skill: [] as string[], refinement: [] as string[] };
  for (const t of Object.values(TECHNIQUES)) byCategory[t.category].push(t.slug);

  const targetLabel = currentTarget
    ? currentTarget.kind === "book"
      ? (isZh ? ITEMS[currentTarget.item_type]?.nameZh : ITEMS[currentTarget.item_type]?.nameEn) ?? currentTarget.item_type
      : (isZh ? TECHNIQUES[(currentTarget as { technique_slug: string }).technique_slug]?.nameZh : TECHNIQUES[(currentTarget as { technique_slug: string }).technique_slug]?.nameEn) ?? ""
    : "";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Page header */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl text-glow-gold">
            {isZh ? "參悟" : "Enlightenment"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {isZh ? "靜心參悟書籍與功法,領悟天道運行之奧妙" : "Study books and techniques in stillness to comprehend the Dao"}
          </p>
        </div>

        {/* ================================================================
            Workshop — "悟道台" — centered, prominent meditation-like layout
            ================================================================ */}
        <Card className={`scroll-surface mb-8 overflow-hidden transition-all duration-500 ${isEnlightening ? "gold-shimmer" : ""}`}>
          <div className="h-1 bg-gradient-to-r from-spirit-gold/60 via-spirit-gold to-spirit-gold/60" />
          <CardContent className="pt-6 pb-6">
            {/* Workshop title — centered */}
            <div className="text-center mb-6">
              <h2 className="font-heading text-xl font-bold text-spirit-gold text-glow-gold">
                {isZh ? "悟道台" : "Dao Comprehension Altar"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {isZh ? "焚香靜坐,翻閱古籍,感悟天機" : "Light incense, study ancient texts, perceive heavenly secrets"}
              </p>
            </div>

            {/* Central progress ring — large and prominent */}
            <div className="flex flex-col items-center mb-6">
              <button
                type="button"
                onClick={() => !isEnlightening && setSelectionOpen(!selectionOpen)}
                className={`relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] rounded-full transition-all duration-300 ${
                  !isEnlightening && !currentTarget ? "hover:scale-[1.02]" : ""
                }`}
                aria-label={isZh ? "選擇參悟目標" : "Select enlightenment target"}
              >
                {/* Ambient glow behind the ring when active */}
                {isEnlightening && (
                  <div
                    className="absolute inset-[-12px] rounded-full opacity-40"
                    style={{
                      background: "radial-gradient(circle, var(--spirit-gold-dim) 0%, transparent 70%)",
                      animation: "qi-pulse 3s ease-in-out infinite",
                    }}
                  />
                )}

                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                  {/* Subtle decorative outer ring */}
                  <circle cx="80" cy="80" r="78" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-spirit-gold/10" />
                  {/* Track ring */}
                  <circle cx="80" cy="80" r={RING_R} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/15" />
                  {/* Progress ring */}
                  {isEnlightening && (
                    <circle
                      cx="80" cy="80" r={RING_R}
                      fill="none"
                      stroke="url(#en-grad)"
                      strokeWidth="4"
                      strokeDasharray={`${actionProgress * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                      strokeLinecap="round"
                      style={{
                        filter: "drop-shadow(0 0 6px rgba(212, 166, 67, 0.6))",
                      }}
                    />
                  )}
                  {/* Tick marks around the ring — 12 like a clock */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const inner = 75;
                    const outer = 78;
                    return (
                      <line
                        key={i}
                        x1={80 + inner * Math.cos(angle)}
                        y1={80 + inner * Math.sin(angle)}
                        x2={80 + outer * Math.cos(angle)}
                        y2={80 + outer * Math.sin(angle)}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-spirit-gold/15"
                      />
                    );
                  })}
                  <defs>
                    <linearGradient id="en-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#d4a643" />
                      <stop offset="100%" stopColor="#e8c56a" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {currentTarget ? (
                    <>
                      <span className="text-5xl sm:text-6xl drop-shadow-lg">
                        {currentTarget.kind === "book" ? (ITEMS[currentTarget.item_type]?.icon ?? "📖") : "📜"}
                      </span>
                      <span className="text-xs font-heading text-spirit-gold mt-2 truncate max-w-[70%] text-glow-gold">
                        {targetLabel}
                      </span>
                      {isEnlightening && (
                        <span className="text-[10px] text-spirit-gold/60 mt-0.5 tabular-nums">
                          {Math.round(actionProgress * 100)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-5xl text-spirit-gold/20">+</span>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {isZh ? "選擇目標" : "Select"}
                      </span>
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Action button */}
            <div className="flex justify-center mb-6">
              {isEnlightening ? (
                <Button
                  size="lg"
                  onClick={stopEnlightenment}
                  className="bg-cinnabar hover:bg-cinnabar/90 text-white font-heading px-8"
                >
                  {isZh ? "停止參悟" : "Stop Enlightenment"}
                </Button>
              ) : currentTarget ? (
                <Button
                  size="lg"
                  onClick={() => currentTarget && startEnlightenment(currentTarget)}
                  className="bg-spirit-gold hover:bg-spirit-gold/90 text-background font-heading px-8"
                >
                  {isZh ? "開始參悟" : "Begin Enlightenment"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isZh ? "點擊上方圓環選擇參悟目標" : "Click the ring above to select a target"}
                </p>
              )}
            </div>

            {/* Stats row — clean aligned stats below the ring */}
            <div className="max-w-sm mx-auto rounded-lg border border-spirit-gold/15 bg-spirit-gold/5 p-4">
              <div className="space-y-1.5 text-sm">
                {[
                  { label: isZh ? "參悟週期" : "Cycle", value: (ENLIGHTENMENT_TICK_MS / 1000).toFixed(1), unit: isZh ? "秒" : "s" },
                  {
                    label: isZh ? "每次經驗" : "XP / tick",
                    value: currentTarget?.kind === "book"
                      ? DAMAGED_BOOK_ENLIGHTENMENT_XP.toString()
                      : ENLIGHTENMENT_TICK_XP.toString(),
                    unit: isZh ? "點" : "p",
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-heading text-spirit-gold flex items-baseline gap-1">
                      <span className="tabular-nums text-right inline-block min-w-[2.5rem]">{row.value}</span>
                      <span className="text-xs text-spirit-gold/70 inline-block min-w-[1rem]">{row.unit}</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="text-muted-foreground">{isZh ? "參悟經驗" : "Total XP"}</span>
                  <span className="font-heading text-spirit-gold tabular-nums">{enlightenmentXp.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{isZh ? "參悟等級" : "Level"}</span>
                  <span className="font-heading text-spirit-gold text-lg tabular-nums">Lv.{enlightenmentLevel}</span>
                </div>
              </div>
            </div>

            {/* Selection overlay — scroll/book menu feel */}
            {selectionOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm" onClick={() => setSelectionOpen(false)} />
                <div className="relative z-50 mt-6 mx-auto max-w-md rounded-xl border border-spirit-gold/20 bg-card shadow-2xl overflow-hidden">
                  {/* Decorative top strip */}
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-spirit-gold/50 to-transparent" />
                  <div className="px-5 py-3 border-b border-border/30">
                    <h3 className="font-heading text-base text-spirit-gold text-center">
                      {isZh ? "選擇參悟之物" : "Select Object of Study"}
                    </h3>
                  </div>

                  <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {/* Books section */}
                    <div>
                      <p className="text-xs font-heading text-spirit-gold/80 mb-2 flex items-center gap-2">
                        <span className="h-px flex-1 bg-spirit-gold/15" />
                        {isZh ? "書籍" : "Books"}
                        <span className="h-px flex-1 bg-spirit-gold/15" />
                      </p>
                      {bookInventory.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">{isZh ? "背包中無可參悟的書籍" : "No books available"}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {bookInventory.map((inv) => {
                            const meta = ITEMS[inv.item_type];
                            if (!meta) return null;
                            return (
                              <button
                                key={inv.item_type}
                                type="button"
                                onClick={() => startEnlightenment({ kind: "book", item_type: inv.item_type })}
                                className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-muted/5 px-4 py-3 text-sm hover:border-spirit-gold/40 hover:bg-spirit-gold/5 transition-all duration-200 group"
                              >
                                <span className="text-2xl group-hover:scale-110 transition-transform">{meta.icon}</span>
                                <span className="flex-1 text-left font-heading truncate">{isZh ? meta.nameZh : meta.nameEn}</span>
                                <span className="text-xs text-muted-foreground tabular-nums shrink-0">x{inv.quantity}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Techniques section */}
                    <div>
                      <p className="text-xs font-heading text-jade/80 mb-2 flex items-center gap-2">
                        <span className="h-px flex-1 bg-jade/15" />
                        {isZh ? "已學功法" : "Learned Techniques"}
                        <span className="h-px flex-1 bg-jade/15" />
                      </p>
                      {(() => {
                        const unmaxed = initialLearned.filter((t) => t.mastery_level < MAX_MASTERY_LEVEL);
                        if (unmaxed.length === 0) {
                          return <p className="text-xs text-muted-foreground text-center py-2">{isZh ? "無可精進的功法" : "No techniques to study"}</p>;
                        }
                        return (
                          <div className="space-y-1.5">
                            {unmaxed.map((t) => {
                              const tech = TECHNIQUES[t.technique_slug];
                              if (!tech) return null;
                              const cfg = CATEGORY_LABELS[tech.category];
                              return (
                                <button
                                  key={t.technique_slug}
                                  type="button"
                                  onClick={() => startEnlightenment({ kind: "technique", technique_slug: t.technique_slug })}
                                  className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-muted/5 px-4 py-3 text-sm hover:border-jade/40 hover:bg-jade/5 transition-all duration-200 group"
                                >
                                  <span className="text-2xl group-hover:scale-110 transition-transform">📜</span>
                                  <div className="flex-1 text-left min-w-0">
                                    <span className="font-heading truncate block">{isZh ? tech.nameZh : tech.nameEn}</span>
                                    <span className={`text-[10px] ${cfg.color}`}>{isZh ? cfg.zh : cfg.en}</span>
                                  </div>
                                  <span className="text-xs text-jade tabular-nums shrink-0">Lv.{t.mastery_level}/{MAX_MASTERY_LEVEL}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Close hint */}
                  <div className="px-4 py-2 border-t border-border/20 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectionOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isZh ? "取消" : "Cancel"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ================================================================
            Technique Library — categorized grid
            ================================================================ */}
        <div className="mb-4">
          <h2 className="font-heading text-lg font-bold mb-1">
            {isZh ? "功法典藏" : "Technique Collection"}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            {isZh ? "已領悟與未知的功法一覽" : "Overview of learned and undiscovered techniques"}
          </p>
        </div>

        {(Object.keys(byCategory) as TechniqueCategory[]).map((cat) => {
          const cfg = CATEGORY_LABELS[cat];
          return (
            <Card key={cat} className="scroll-surface mb-5 overflow-hidden">
              <div className={`h-1 ${cfg.accent}`} />
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className={`font-heading text-base font-bold ${cfg.color}`}>
                    {isZh ? cfg.zh : cfg.en}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ({byCategory[cat].filter((s) => learnedMap.has(s)).length}/{byCategory[cat].length})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {byCategory[cat].map((slug) => {
                    const tech = TECHNIQUES[slug];
                    const learned = learnedMap.get(slug);
                    const isLearned = !!learned;
                    const isMaxed = learned?.mastery_level === MAX_MASTERY_LEVEL;
                    const threshold = learned ? MASTERY_THRESHOLDS[learned.mastery_level] ?? 0 : 0;
                    const masteryPct = threshold > 0 ? Math.min(((learned?.mastery_xp ?? 0) / threshold) * 100, 100) : 0;

                    if (!isLearned) {
                      /* Mysterious unknown technique — faded locked feel */
                      return (
                        <div
                          key={slug}
                          className="rounded-lg border border-dashed border-border/20 bg-muted/5 p-4 flex flex-col items-center justify-center text-center min-h-[130px] opacity-50"
                        >
                          <div className="text-4xl text-muted-foreground/20 font-heading select-none mb-2">?</div>
                          <p className="text-[10px] text-muted-foreground/40 font-heading">
                            {isZh ? "未領悟" : "Unknown"}
                          </p>
                        </div>
                      );
                    }

                    /* Learned technique card */
                    return (
                      <div
                        key={slug}
                        className={`rounded-lg border-2 p-4 flex flex-col items-center text-center min-h-[130px] transition-all duration-200 hover:scale-[1.02] ${
                          isMaxed
                            ? "border-spirit-gold/50 bg-spirit-gold/10"
                            : `${cfg.border} ${cfg.bg}`
                        }`}
                      >
                        <div className={`text-3xl mb-2 ${isMaxed ? "drop-shadow-lg" : ""}`}>
                          {isMaxed ? "🌟" : "📜"}
                        </div>
                        <p className="text-sm font-heading leading-tight truncate w-full mb-1">
                          {isZh ? tech.nameZh : tech.nameEn}
                        </p>
                        <p className={`text-xs font-heading ${isMaxed ? "text-spirit-gold text-glow-gold" : cfg.color}`}>
                          Lv.{learned.mastery_level}/{MAX_MASTERY_LEVEL}
                        </p>
                        {!isMaxed && threshold > 0 && (
                          <div className="w-full mt-2 space-y-0.5">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  cat === "cultivation" ? "bg-jade/60" : cat === "skill" ? "bg-blue-400/60" : "bg-spirit-gold/60"
                                }`}
                                style={{ width: `${masteryPct}%` }}
                              />
                            </div>
                            <p className="text-[9px] text-muted-foreground tabular-nums">
                              {learned.mastery_xp}/{threshold}
                            </p>
                          </div>
                        )}
                        {isMaxed && (
                          <p className="text-[9px] text-spirit-gold/70 mt-1 font-heading">
                            {isZh ? "圓滿" : "Mastered"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Learnable technique books */}
        {bookInventory.some((i) => !!TECHNIQUES[i.item_type]) && (
          <Card className="scroll-surface mt-2 overflow-hidden">
            <div className="h-1 bg-jade" />
            <CardContent className="pt-5 pb-5">
              <h3 className="font-heading text-base font-bold text-jade mb-4">
                {isZh ? "可學習的功法書" : "Learnable Technique Books"}
              </h3>
              <div className="space-y-2">
                {bookInventory
                  .filter((i) => !!TECHNIQUES[i.item_type])
                  .map((inv) => {
                    const meta = ITEMS[inv.item_type];
                    const tech = TECHNIQUES[inv.item_type];
                    const already = learnedMap.has(inv.item_type);
                    if (!meta || !tech) return null;
                    return (
                      <div key={inv.item_type} className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/5 px-4 py-3 hover:border-jade/30 transition-colors">
                        <span className="text-2xl">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading text-sm">{isZh ? meta.nameZh : meta.nameEn}</p>
                          <p className="text-xs text-muted-foreground truncate">{isZh ? tech.descZh : tech.descEn}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={already ? "outline" : "default"}
                          disabled={already || learning === inv.item_type}
                          onClick={() => learnBook(inv.item_type)}
                          className={already ? "" : "bg-jade hover:bg-jade/90 text-background font-heading"}
                        >
                          {already
                            ? (isZh ? "已領悟" : "Learned")
                            : learning === inv.item_type
                            ? (isZh ? "領悟中..." : "Learning...")
                            : (isZh ? "領悟" : "Learn")}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
