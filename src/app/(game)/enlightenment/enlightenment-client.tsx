"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { melvorXpForLevel } from "@/lib/types";

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
  const [booksHidden, setBooksHidden] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("xian_books_hidden") === "1";
    return false;
  });
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [isEnlightening, setIsEnlightening] = useState(false);
  const [actionProgress, setActionProgress] = useState(0);
  const tickStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingTicksRef = useRef(0);

  const learnedMap = new Map(initialLearned.map((t) => [t.technique_slug, t]));
  // Regular books (破損書籍 etc.) — excludes technique books (those go through "learn" flow)
  const regularBooks = inventory.filter((i) => hasTag(i.item_type, "book") && !TECHNIQUES[i.item_type] && i.quantity > 0);
  // Tomes in inventory (典藏 — learnable technique items)
  const techniqueBooks = inventory.filter((i) => hasTag(i.item_type, "tome") && i.quantity > 0);

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

  // Step 1: select target into slot (doesn't start yet)
  const selectTarget = (target: Target) => {
    if (isEnlightening) return; // can't change while running
    setCurrentTarget(target);
    setSelectionOpen(false);
  };

  // Step 2: begin enlightenment (user clicks "開始參悟")
  const startEnlightenment = async () => {
    if (!currentTarget) return;
    if (gameState.isMining) gameState.stopMining();
    if (gameState.isMeditating) gameState.stopMeditation();
    setIsEnlightening(true);
    pendingTicksRef.current = 0;
    await fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "enlightenment", target: currentTarget, requested_at: Date.now() }),
      keepalive: true,
    });
  };

  // Remove target from slot
  const clearTarget = () => {
    if (isEnlightening) return;
    setCurrentTarget(null);
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
    await fetch("/api/game/stop-activity", {
      method: "POST",
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
        {/* Page header — matches mining layout: left title + right badges + XP bar */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-spirit-gold/10 border border-spirit-gold/20">
              <span className="text-xl">📜</span>
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold sm:text-2xl">{isZh ? "參悟" : "Enlightenment"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-spirit-gold/30 text-spirit-gold font-heading px-3 py-1 text-sm">
              {isZh ? "參悟等級" : "Enlightenment Lv"} {enlightenmentLevel}
            </Badge>
            <Badge variant="outline" className="border-border/40 text-muted-foreground tabular-nums px-3 py-1 text-sm">
              XP {(enlightenmentXp - melvorXpForLevel(enlightenmentLevel)).toLocaleString()} / {(melvorXpForLevel(enlightenmentLevel + 1) - melvorXpForLevel(enlightenmentLevel)).toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Skill XP bar */}
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-spirit-gold transition-all duration-300"
            style={{ width: `${(() => {
              const totalForLevel = melvorXpForLevel(enlightenmentLevel + 1) - melvorXpForLevel(enlightenmentLevel);
              const xpInLevel = enlightenmentXp - melvorXpForLevel(enlightenmentLevel);
              return totalForLevel > 0 ? Math.min((xpInLevel / totalForLevel) * 100, 100) : 0;
            })()}%` }}
          />
        </div>

        {/* ================================================================
            Workshop — "悟道台" — centered, prominent meditation-like layout
            ================================================================ */}
        <Card className={`scroll-surface mb-8 overflow-hidden transition-all duration-500 ${isEnlightening ? "gold-shimmer" : ""}`}>
          <div className="h-1 bg-gradient-to-r from-spirit-gold/60 via-spirit-gold to-spirit-gold/60" />
          <CardContent className="pt-5 pb-5">
            <div className="rounded-lg border border-spirit-gold/20 bg-spirit-gold/5 overflow-hidden">
              <div className="grid grid-cols-2 gap-4 p-4">
                {/* Left: ring + buttons */}
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { if (!isEnlightening) setSelectionOpen(!selectionOpen); }}
                    className={`relative w-full aspect-square max-w-[150px] rounded-full transition-all duration-300 ${!isEnlightening && !currentTarget ? "hover:scale-[1.02]" : ""}`}
                  >
                    {isEnlightening && (
                      <div className="absolute inset-[-12px] rounded-full opacity-40" style={{ background: "radial-gradient(circle, var(--spirit-gold-dim) 0%, transparent 70%)", animation: "qi-pulse 3s ease-in-out infinite" }} />
                    )}
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="78" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-spirit-gold/10" />
                      <circle cx="80" cy="80" r={RING_R} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/15" />
                      {isEnlightening && (
                        <circle cx="80" cy="80" r={RING_R} fill="none" stroke="url(#en-grad)" strokeWidth="4" strokeDasharray={`${actionProgress * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(212,166,67,0.6))" }} />
                      )}
                      {Array.from({ length: 12 }).map((_, i) => { const a = (i * 30 * Math.PI) / 180; return <line key={i} x1={80+75*Math.cos(a)} y1={80+75*Math.sin(a)} x2={80+78*Math.cos(a)} y2={80+78*Math.sin(a)} stroke="currentColor" strokeWidth="1" className="text-spirit-gold/15" />; })}
                      <defs><linearGradient id="en-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d4a643" /><stop offset="100%" stopColor="#e8c56a" /></linearGradient></defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {currentTarget ? (
                        <>
                          <span className="text-5xl drop-shadow-lg">{currentTarget.kind === "book" ? (ITEMS[currentTarget.item_type]?.icon ?? "📖") : "📜"}</span>
                          <span className="text-xs font-heading text-spirit-gold mt-2 truncate max-w-[70%] text-glow-gold">{targetLabel}</span>
                          {isEnlightening && <span className="text-[10px] text-spirit-gold/60 mt-0.5 tabular-nums">{Math.round(actionProgress * 100)}%</span>}
                        </>
                      ) : (
                        <>
                          <span className="text-5xl text-spirit-gold/20">+</span>
                          <span className="text-[10px] text-muted-foreground mt-1">{isZh ? "選擇目標" : "Select"}</span>
                        </>
                      )}
                    </div>
                  </button>
                  {/* Action buttons */}
                  {isEnlightening ? (
                    <Button size="sm" onClick={stopEnlightenment} className="w-full bg-cinnabar hover:bg-cinnabar/90 text-white font-heading">
                      {isZh ? "停止參悟" : "Stop"}
                    </Button>
                  ) : currentTarget ? (
                    <Button size="sm" onClick={() => startEnlightenment()} className="w-full bg-spirit-gold hover:bg-spirit-gold/90 text-background font-heading">
                      {isZh ? "開始參悟" : "Start"}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">{isZh ? "點擊上方選擇參悟目標" : "Click above to select target"}</p>
                  )}
                </div>

                {/* Right: title + stats — vertically centered */}
                <div className="min-w-0 space-y-3 flex flex-col justify-center">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-spirit-gold">{isZh ? "悟道台" : "Dao Comprehension Altar"}</h3>
                    <p className="text-sm text-muted-foreground">{isZh ? "焚香靜坐,翻閱古籍,感悟天機" : "Light incense, study ancient texts, perceive heavenly secrets"}</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {[
                      { label: isZh ? "參悟週期" : "Cycle", value: (ENLIGHTENMENT_TICK_MS / 1000).toFixed(1), unit: isZh ? "秒" : "s" },
                      { label: isZh ? "每次經驗" : "XP / tick", value: currentTarget?.kind === "book" ? DAMAGED_BOOK_ENLIGHTENMENT_XP.toString() : ENLIGHTENMENT_TICK_XP.toString(), unit: isZh ? "點" : "p" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-heading text-spirit-gold flex items-baseline gap-1">
                          <span className="tabular-nums text-right inline-block min-w-[2.5rem]">{row.value}</span>
                          <span className="text-xs text-spirit-gold/70 inline-block min-w-[1rem]">{row.unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
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
                    {/* Clear slot */}
                    {currentTarget && (
                      <button
                        type="button"
                        onClick={() => { clearTarget(); setSelectionOpen(false); }}
                        className="w-full flex items-center gap-3 rounded-lg border border-cinnabar/30 bg-cinnabar/5 px-4 py-3 text-sm hover:border-cinnabar/50 hover:bg-cinnabar/10 transition-all duration-200 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform">🚫</span>
                        <span className="flex-1 text-left font-heading text-cinnabar">{isZh ? "清空" : "Clear"}</span>
                      </button>
                    )}

                    {/* Books section */}
                    <div>
                      <p className="text-xs font-heading text-spirit-gold/80 mb-2 flex items-center gap-2">
                        <span className="h-px flex-1 bg-spirit-gold/15" />
                        {isZh ? "書籍" : "Books"}
                        <span className="h-px flex-1 bg-spirit-gold/15" />
                      </p>
                      {regularBooks.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">{isZh ? "背包中無可參悟的書籍" : "No books available"}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {regularBooks.map((inv) => {
                            const meta = ITEMS[inv.item_type];
                            if (!meta) return null;
                            return (
                              <button
                                key={inv.item_type}
                                type="button"
                                onClick={() => selectTarget({ kind: "book", item_type: inv.item_type })}
                                className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-muted/5 px-4 py-3 text-sm hover:border-spirit-gold/40 hover:bg-spirit-gold/5 transition-all duration-200 group"
                              >
                                {meta.image ? (
                                  <img src={meta.image} alt="" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform" />
                                ) : (
                                  <span className="text-2xl group-hover:scale-110 transition-transform">{meta.icon}</span>
                                )}
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
                                  onClick={() => selectTarget({ kind: "technique", technique_slug: t.technique_slug })}
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

        {/* Learnable technique books — only unlearned, with eye toggle to hide */}
        {(() => {
          const unlearnedBooks = techniqueBooks.filter((i) => !learnedMap.has(i.item_type));
          if (unlearnedBooks.length === 0) return null;
          const toggleHidden = () => {
            setBooksHidden((v) => {
              const nv = !v;
              try { localStorage.setItem("xian_books_hidden", nv ? "1" : "0"); } catch {}
              return nv;
            });
          };
          return (
            <Card className="scroll-surface mb-5 overflow-hidden">
              <div className="h-1 bg-jade" />
              <CardContent className={booksHidden ? "pt-4 pb-3" : "pt-4 pb-5"}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-heading text-base font-bold text-jade">
                    {isZh ? "可學習的典藏" : "Learnable Tomes"}
                  </h3>
                  <button
                    type="button"
                    onClick={toggleHidden}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
                    aria-label={booksHidden ? (isZh ? "顯示" : "Show") : (isZh ? "隱藏" : "Hide")}
                  >
                    {booksHidden ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {!booksHidden && (
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 mt-3">
                    {unlearnedBooks.map((inv) => {
                      const meta = ITEMS[inv.item_type];
                      const tech = TECHNIQUES[inv.item_type];
                      if (!meta || !tech) return null;
                      return (
                        <button
                          key={inv.item_type}
                          type="button"
                          disabled={learning === inv.item_type}
                          onClick={() => learnBook(inv.item_type)}
                          className="group relative aspect-square rounded-md border border-jade/30 bg-jade/5 flex flex-col items-center justify-center text-center transition-all hover:border-jade/60 hover:bg-jade/10"
                        >
                          <span className="text-[clamp(0.6rem,3vw,1rem)] leading-none">{meta.icon}</span>
                          <span className="text-[clamp(5px,1.2vw,8px)] font-heading leading-none truncate w-full px-px mt-0.5">
                            {isZh ? meta.nameZh : meta.nameEn}
                          </span>
                          <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] text-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            {isZh ? `${meta.nameZh} — 點擊領悟` : `${meta.nameEn} — Click to learn`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Technique library — rows: 功法類 → 修煉類 → 技能類, 10 slots each */}
        <Card className="scroll-surface mb-5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-jade via-spirit-gold to-blue-400" />
          <CardContent className="pt-5 pb-5 space-y-4">
            {(["cultivation", "refinement", "skill"] as TechniqueCategory[]).map((cat) => {
              const cfg = CATEGORY_LABELS[cat];
              const TOTAL_SLOTS = 10;
              const knownSlugs = byCategory[cat]; // defined techniques
              // Build 10 slots: fill with known techniques, pad with empty
              const slots: (string | null)[] = [...knownSlugs];
              while (slots.length < TOTAL_SLOTS) slots.push(null);

              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`font-heading text-sm font-bold ${cfg.color}`}>
                      {isZh ? cfg.zh : cfg.en}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      ({knownSlugs.filter((s) => learnedMap.has(s)).length}/{TOTAL_SLOTS})
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {slots.map((slug, i) => {
                      const tech = slug ? TECHNIQUES[slug] : null;
                      const learned = slug ? learnedMap.get(slug) : null;
                      const isLearned = !!learned;
                      const isMaxed = learned?.mastery_level === MAX_MASTERY_LEVEL;
                      const threshold = learned ? MASTERY_THRESHOLDS[learned.mastery_level] ?? 0 : 0;
                      const masteryPct = threshold > 0 ? Math.min(((learned?.mastery_xp ?? 0) / threshold) * 100, 100) : 0;

                      if (!isLearned) {
                        return (
                          <div key={slug ?? `empty-${cat}-${i}`} className="group relative aspect-square rounded-md border border-dashed border-border/20 bg-muted/5 flex items-center justify-center opacity-40">
                            <span className="text-lg text-muted-foreground/30 font-heading select-none">?</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={slug}
                          className={`group relative aspect-square rounded-md border flex flex-col items-center justify-center text-center transition-all ${
                            isMaxed ? "border-spirit-gold/50 bg-spirit-gold/10" : `${cfg.border} ${cfg.bg}`
                          }`}
                        >
                          <span className="text-[clamp(0.6rem,3vw,1rem)] leading-none">{isMaxed ? "🌟" : "📜"}</span>
                          <span className="text-[clamp(5px,1.2vw,8px)] font-heading leading-none truncate w-full px-px mt-0.5">
                            {isZh ? tech!.nameZh : tech!.nameEn}
                          </span>
                          {/* Mastery bar at bottom */}
                          {!isMaxed && threshold > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md overflow-hidden bg-muted/20">
                              <div className={`h-full ${cat === "cultivation" ? "bg-jade/70" : cat === "skill" ? "bg-blue-400/70" : "bg-spirit-gold/70"}`} style={{ width: `${masteryPct}%` }} />
                            </div>
                          )}
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] text-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            {isZh ? tech!.nameZh : tech!.nameEn} Lv.{learned.mastery_level}/{MAX_MASTERY_LEVEL}
                            {!isMaxed && ` (${learned.mastery_xp}/${threshold})`}
                            {isMaxed && (isZh ? " 圓滿" : " Mastered")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Learnable books — removed from bottom, now above technique library */}
      </div>
    </div>
  );
}
