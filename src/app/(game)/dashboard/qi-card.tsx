"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { qiXpForStage, qiBaseRate, spiritStoneBonus, type Profile } from "@/lib/types";
import { ITEMS, hasTag } from "@/lib/items";
import { useI18n } from "@/lib/i18n";
import { useGameState } from "@/components/mining-provider";
import { useRouter } from "next/navigation";

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

const TICK_XP = 10;

interface QiCardProps {
  profile: Profile;
  mounted: boolean;
  onBreakthroughClick: () => void;
}

export function QiCard({ profile, mounted, onBreakthroughClick }: QiCardProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const {
    isMeditating: meditating,
    startMeditation,
    stopMeditation,
    qiXp: providerQiXp,
    meditationProgress: actionProgress,
    inventory,
    updateQiArray,
  } = useGameState();
  const router = useRouter();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  // Optimistic local copy — updates instantly, server sync in background
  const [qiArrayLocal, setQiArrayLocal] = useState<(string | null)[]>(
    profile.qi_array ?? [null, null, null, null, null]
  );
  useEffect(() => {
    setQiArrayLocal(profile.qi_array ?? [null, null, null, null, null]);
  }, [profile.qi_array]);
  const qiArray = qiArrayLocal;

  const spiritStoneInv = inventory.filter((i) => hasTag(i.item_type, "spirit_stone") && i.quantity > 0);

  const totalBonusPerTick = qiArray.reduce((sum, it) => sum + spiritStoneBonus(it), 0);

  const equip = (slotIdx: number, itemType: string | null) => {
    setOpenSlot(null);
    // Optimistic update — instant UI feedback
    setQiArrayLocal((prev) => {
      const next = [...prev];
      next[slotIdx] = itemType;
      // Propagate to provider so the tick loop uses the new config immediately
      updateQiArray(next);
      return next;
    });
    // Fire and forget server sync
    fetch("/api/game/qi-array", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_index: slotIdx, item_type: itemType }),
    }).then(() => {
      router.refresh();
    }).catch(() => {
      // Rollback on error — both local state AND provider
      const original = profile.qi_array ?? [null, null, null, null, null];
      setQiArrayLocal(original);
      updateQiArray(original);
    });
  };
  const qiLvl = profile.qi_level || 1;
  // Show server-loaded qi_xp until provider has emitted any tick (then provider takes over)
  const [, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const qiXp = Math.max(profile.qi_xp || 0, providerQiXp || 0);

  const qiNeed = qiXpForStage(qiLvl);
  const qiPct = Math.min((qiXp / qiNeed) * 100, 100);
  const qiReady = qiXp >= qiNeed;
  const failBonus = (profile.qi_fail_bonus ?? {})[String(qiLvl)] ?? 0;
  const effectiveRate = Math.min(100, qiBaseRate(qiLvl) + failBonus);
  const isPeakAttempt = qiLvl >= 13;

  // 3 spirit stone slots (placeholder — future: equip 靈石 items for bonus)
  const STONE_SLOTS = 5;

  return (
    <Card
      className={`scroll-surface transition-all duration-300 mb-4 ${qiReady ? "qi-glow" : ""}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.96)",
        transition: "all 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s",
      }}
    >
      <CardContent className="pt-1 space-y-5">
        {/* === Header === */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-xl font-bold">
              {isZh ? "練氣期" : "Qi Condensation"}{" "}
              <span className="text-jade text-glow-jade">
                {qiLvl >= 13 ? (isZh ? "巔峰" : "Peak") : `${qiLvl} ${isZh ? "級" : "Lv"}`}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isZh ? "凝聚靈氣 — 透過冥想累積修為" : "Condense spiritual energy through meditation"}
            </p>
          </div>
          {qiReady && (
            <Button
              onClick={onBreakthroughClick}
              className={`shrink-0 font-heading ${isPeakAttempt ? "bg-cinnabar hover:bg-cinnabar/90" : "seal-glow"} animate-pulse hover:animate-none hover:scale-[1.02] transition-transform`}
              size="lg"
            >
              {isPeakAttempt ? (isZh ? "嘗試築基" : "Attempt Foundation") : (isZh ? "突破" : "Break Through")}
            </Button>
          )}
        </div>

        {/* === Main XP bar (靈氣) === */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{isZh ? "靈氣" : "Progress"}</span>
            <span className="font-heading tabular-nums text-foreground">
              {formatNumber(qiXp)} / {formatNumber(qiNeed)}
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-jade to-blue-400 transition-all duration-500 ease-out"
              style={{ width: `${qiPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.min(Math.round(qiPct), 100)}%
            </span>
            {qiReady && (
              <span className="text-xs font-medium text-jade animate-pulse">
                {isZh ? "可以突破了！" : "Ready to break through!"}
              </span>
            )}
          </div>
        </div>

        {/* === Risk bar — breakthrough success rate === */}
        {(() => {
          const baseRate = qiBaseRate(qiLvl);
          const rateColor =
            effectiveRate >= 90 ? "from-jade to-emerald-400"
            : effectiveRate >= 70 ? "from-spirit-gold to-amber-300"
            : effectiveRate >= 50 ? "from-orange-400 to-amber-500"
            : "from-cinnabar to-red-500";
          const textColor =
            effectiveRate >= 90 ? "text-jade"
            : effectiveRate >= 70 ? "text-spirit-gold"
            : effectiveRate >= 50 ? "text-orange-400"
            : "text-cinnabar";
          const isHighRisk = effectiveRate < 50;

          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className={`font-heading tabular-nums ${textColor}`}>
                  {isZh ? "突破成功率" : "Success Rate"} {effectiveRate}%
                </span>
                {(isPeakAttempt || effectiveRate < 100) && (
                  <span className={`text-[11px] ${isPeakAttempt ? "text-cinnabar/80" : "text-muted-foreground"}`}>
                    {isPeakAttempt
                      ? (isZh ? "⚠ 失敗將扣除靈氣" : "⚠ Failure consumes qi")
                      : (isZh ? "失敗將扣除靈氣並 +1% 成功率" : "Failure: -qi, +1% rate")}
                  </span>
                )}
              </div>
              <div className={`relative h-3 w-full overflow-hidden rounded-full bg-cinnabar/15 ${isHighRisk ? "risk-pulse-sync" : ""}`}>
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${rateColor}`}
                  style={{ width: `${baseRate}%` }}
                />
                {failBonus > 0 && (
                  <div
                    className="absolute inset-y-0 rounded-full bg-jade/40"
                    style={{ left: `${baseRate}%`, width: `${Math.min(failBonus, 100 - baseRate)}%` }}
                  />
                )}
                <div className="absolute inset-y-0 right-0 w-px bg-foreground/20" />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-sm bg-gradient-to-r ${rateColor}`} />
                  {isZh ? "基礎" : "Base"} <span className="tabular-nums">{baseRate}%</span>
                </span>
                {failBonus > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-jade/40" />
                    {isZh ? "失敗累積" : "Fail bonus"} <span className="tabular-nums text-jade">+{failBonus}%</span>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* === Meditation panel (2-column layout) === */}
        <div className="rounded-lg border border-jade/20 bg-jade/5 overflow-hidden">
          {/* Panel body — 2 column: animation (left half) / buff slots (right half) */}
          <div className="grid grid-cols-2 gap-4 p-4">
            {/* Left: seated figure + orbit + button — occupies left half */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-full aspect-square max-w-[260px]">
                {/* Qi aura — multi-layer pulsing glow behind the figure */}
                {meditating && (
                  <>
                    <div
                      className="absolute left-1/2 top-1/2 w-[90%] h-[90%] rounded-full pointer-events-none"
                      style={{
                        background: "radial-gradient(circle, oklch(0.65 0.15 160 / 25%) 0%, oklch(0.65 0.15 160 / 8%) 50%, transparent 70%)",
                        animation: "qi-aura-pulse 3s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 w-[70%] h-[70%] rounded-full pointer-events-none"
                      style={{
                        background: "radial-gradient(circle, oklch(0.65 0.15 160 / 18%) 0%, oklch(0.65 0.15 160 / 5%) 60%, transparent 80%)",
                        animation: "qi-aura-pulse 2.4s ease-in-out 0.5s infinite",
                      }}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 w-[50%] h-[50%] rounded-full pointer-events-none"
                      style={{
                        background: "radial-gradient(circle, oklch(0.65 0.15 160 / 12%) 0%, transparent 70%)",
                        animation: "qi-aura-pulse 2s ease-in-out 1s infinite",
                      }}
                    />
                  </>
                )}

                {/* Outer rotating orbit — meridian lines */}
                {meditating && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 260" style={{ animation: "qi-orbit 25s linear infinite" }}>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const a = (i * 30 * Math.PI) / 180;
                      return (
                        <g key={i}>
                          <line x1={130 + 110 * Math.cos(a)} y1={130 + 110 * Math.sin(a)} x2={130 + 120 * Math.cos(a)} y2={130 + 120 * Math.sin(a)} stroke="#6fe0c8" strokeWidth="1.5" opacity="0.3" />
                          <line x1={130 + 114 * Math.cos(a - 0.06)} y1={130 + 114 * Math.sin(a - 0.06)} x2={130 + 114 * Math.cos(a + 0.06)} y2={130 + 114 * Math.sin(a + 0.06)} stroke="#6fe0c8" strokeWidth="0.5" opacity="0.2" />
                        </g>
                      );
                    })}
                    <circle cx="130" cy="130" r="118" fill="none" stroke="#6fe0c8" strokeWidth="0.4" opacity="0.15" strokeDasharray="3 10" />
                  </svg>
                )}

                {/* Counter-rotating inner orbit — acupoint dots */}
                {meditating && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 260" style={{ animation: "qi-orbit-reverse 18s linear infinite" }}>
                    <circle cx="130" cy="130" r="108" fill="none" stroke="#6fe0c8" strokeWidth="0.3" opacity="0.12" strokeDasharray="2 14" />
                    {Array.from({ length: 16 }).map((_, i) => {
                      const a = (i * 22.5 * Math.PI) / 180;
                      return <circle key={i} cx={130 + 108 * Math.cos(a)} cy={130 + 108 * Math.sin(a)} r="1" fill="#6fe0c8" opacity="0.25" />;
                    })}
                  </svg>
                )}

                {/* Seated figure — smaller when meditating to leave room for aura */}
                <img
                  src="/images/adventure/me.png"
                  alt=""
                  className={`absolute object-contain opacity-85 transition-all duration-500 ${meditating ? "inset-[12%] w-[76%] h-[76%]" : "inset-0 w-full h-full"}`}
                  style={{
                    left: meditating ? "12%" : "0",
                    top: meditating ? "12%" : "0",
                    filter: meditating ? "drop-shadow(0 0 14px rgba(80,200,180,0.55))" : "none",
                  }}
                />

                {/* Main progress ring */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 260 260"
                >
                  <defs>
                    <linearGradient id="qi-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#6fe0c8" />
                      <stop offset="50%" stopColor="#80e8d0" />
                      <stop offset="100%" stopColor="#5aa8ff" />
                    </linearGradient>
                    <radialGradient id="qi-center-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#6fe0c8" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#6fe0c8" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {/* Track */}
                  <circle cx="130" cy="130" r="100" fill="none" stroke="rgba(120,180,170,0.12)" strokeWidth="2.5" />
                  {/* Progress arc */}
                  <circle
                    cx="130"
                    cy="130"
                    r="100"
                    fill="none"
                    stroke="url(#qi-grad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 100}`}
                    strokeDashoffset={`${2 * Math.PI * 100 * (1 - actionProgress)}`}
                    style={{
                      filter: meditating ? "drop-shadow(0 0 8px rgba(100,220,200,0.7))" : "none",
                      transition: "stroke-dashoffset 0.1s linear",
                    }}
                  />
                </svg>

                {/* Floating qi particles */}
                {meditating && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2 rounded-full"
                        style={{
                          width: "6px",
                          height: "6px",
                          background: i % 2 === 0 ? "#6fe0c8" : "#5aa8ff",
                          boxShadow: `0 0 8px ${i % 2 === 0 ? "rgba(111,224,200,0.7)" : "rgba(90,168,255,0.7)"}, 0 0 16px ${i % 2 === 0 ? "rgba(111,224,200,0.3)" : "rgba(90,168,255,0.3)"}`,
                          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-75px)`,
                          animation: `qi-particle-rise 2.8s ease-in-out ${i * 0.35}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => (meditating ? stopMeditation() : startMeditation())}
                className={`w-full font-heading ${meditating ? "bg-cinnabar hover:bg-cinnabar/90 text-white" : "bg-jade hover:bg-jade/90 text-background"}`}
              >
                {meditating ? (isZh ? "停止冥想" : "Stop") : (isZh ? "開始冥想" : "Meditate")}
              </Button>
            </div>

            {/* Right: buff/stone slots + stats */}
            <div className="min-w-0 space-y-3">
              {/* Section title */}
              <div>
                <h3 className="font-heading text-lg font-bold text-jade">{isZh ? "冥想修煉" : "Meditation"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isZh ? "盤膝靜坐,引天地靈氣入體,凝練修為" : "Sit cross-legged, draw spiritual energy from heaven and earth"}
                </p>
              </div>

              {/* Spirit stone slots */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-heading font-bold text-spirit-gold tracking-wide">
                    {isZh ? "聚靈陣" : "Qi Array"}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    {isZh ? "點擊裝填以加成靈氣" : "Equip to boost qi gain"}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: STONE_SLOTS }).map((_, i) => {
                    const locked = i > 0;
                    const equipped = qiArray[i];
                    const equippedMeta = equipped ? ITEMS[equipped] : null;
                    const invCount = equipped
                      ? (inventory.find((x) => x.item_type === equipped)?.quantity ?? 0)
                      : 0;

                    if (locked) {
                      return (
                        <div
                          key={i}
                          className="group relative aspect-square rounded-md border border-cinnabar/40 bg-cinnabar/10 flex items-center justify-center cursor-not-allowed"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cinnabar/70">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] text-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {isZh ? "透過功法解鎖" : "Unlock via cultivation technique"}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenSlot(openSlot === i ? null : i)}
                          className={`group relative aspect-square w-full rounded-md transition-colors flex items-center justify-center ${
                            equipped
                              ? "border-2 border-spirit-gold/60 bg-spirit-gold/10 hover:bg-spirit-gold/15"
                              : "border border-dashed border-spirit-gold/25 bg-muted/10 hover:border-spirit-gold/60 hover:bg-spirit-gold/5"
                          }`}
                        >
                          {equipped ? (
                            <>
                              <img src={`/images/items/${equipped}.png`} alt="" className="w-8 h-8 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]" />
                              <span className="absolute bottom-0 right-0.5 text-[9px] font-heading text-spirit-gold tabular-nums">
                                {invCount}
                              </span>
                            </>
                          ) : (
                            <span className="text-spirit-gold/30 text-xs group-hover:text-spirit-gold/60 transition-colors">+</span>
                          )}
                          {/* Tooltip on hover */}
                          {equipped && equippedMeta ? (
                            <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2.5 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <p className="text-sm font-heading">{isZh ? equippedMeta.nameZh : equippedMeta.nameEn}</p>
                              {equippedMeta.hintZh && <p className="text-xs text-spirit-gold">{isZh ? equippedMeta.hintZh : equippedMeta.hintEn}</p>}
                              <p className="text-xs text-jade">{isZh ? `每次冥想 +${spiritStoneBonus(equipped)} 靈氣` : `+${spiritStoneBonus(equipped)} qi per tick`}</p>
                            </div>
                          ) : (
                            <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] text-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              {isZh ? "裝填靈石" : "Equip spirit stone"}
                            </div>
                          )}
                        </button>

                        {/* Popover — redesigned */}
                        {openSlot === i && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenSlot(null)} />
                            <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border/60 bg-card shadow-xl overflow-hidden">
                              <div className="px-3 py-2 border-b border-border/30 text-[11px] font-heading text-spirit-gold">
                                {isZh ? "選擇靈石" : "Select Spirit Stone"}
                              </div>
                              {spiritStoneInv.length === 0 && !equipped && (
                                <div className="px-3 py-3 text-xs text-muted-foreground">
                                  {isZh ? "背包中沒有靈石" : "No spirit stones in bag"}
                                </div>
                              )}
                              {spiritStoneInv.map((inv) => {
                                const meta = ITEMS[inv.item_type];
                                if (!meta) return null;
                                return (
                                  <button
                                    key={inv.item_type}
                                    type="button"
                                    onClick={() => equip(i, inv.item_type)}
                                    className="group/item relative w-full px-3 py-2.5 text-left hover:bg-spirit-gold/10 transition-colors flex items-center gap-2"
                                  >
                                    <img src={`/images/items/${inv.item_type}.png`} alt="" className="w-6 h-6 object-contain" />
                                    <span className="text-sm text-jade font-heading">+{spiritStoneBonus(inv.item_type)}{isZh ? "點靈氣" : " qi"}</span>
                                    {/* Tooltip on hover */}
                                    <div className="pointer-events-none absolute left-1/2 -top-1 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/60 bg-card px-2.5 py-1.5 shadow-lg opacity-0 group-hover/item:opacity-100 transition-opacity z-60">
                                      <p className="text-sm font-heading">{isZh ? meta.nameZh : meta.nameEn}</p>
                                      {meta.hintZh && <p className="text-xs text-spirit-gold">{isZh ? meta.hintZh : meta.hintEn}</p>}
                                    </div>
                                    <span className="text-xs text-muted-foreground tabular-nums ml-auto">×{inv.quantity}</span>
                                  </button>
                                );
                              })}
                              {equipped && (
                                <button
                                  type="button"
                                  onClick={() => equip(i, null)}
                                  className="w-full px-3 py-2 text-left hover:bg-cinnabar/10 transition-colors flex items-center gap-2 text-sm border-t border-border/30 text-cinnabar"
                                >
                                  <span className="text-base">✕</span>
                                  <span>{isZh ? "取消裝填" : "Unequip"}</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats list — fixed-width numeric column for alignment */}
              <div className="space-y-1.5 text-sm">
                {[
                  { label: isZh ? "冥想週期" : "Cycle", value: "10.0", unit: isZh ? "秒" : "s" },
                  { label: isZh ? "每次冥想" : "Per tick", value: TICK_XP.toFixed(1), unit: isZh ? "點" : "p" },
                  { label: isZh ? "靈石加成" : "Stone bonus", value: `+${totalBonusPerTick.toFixed(1)}`, unit: isZh ? "點" : "p" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-heading text-jade flex items-baseline gap-1">
                      <span className="tabular-nums text-right inline-block min-w-[2.5rem]">{row.value}</span>
                      <span className="text-xs text-jade/70 inline-block min-w-[1rem]">{row.unit}</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t-2 border-border/60 pt-2 mt-2">
                  <span className="text-muted-foreground">{isZh ? "總獲得 / 秒" : "Gain / sec"}</span>
                  <span className="font-heading text-jade flex items-baseline gap-1">
                    <span className="tabular-nums text-right inline-block min-w-[2.5rem]">{((TICK_XP + totalBonusPerTick) / 10).toFixed(1)}</span>
                    <span className="text-xs text-jade/70 inline-block min-w-[1rem]">{isZh ? "點" : "p"}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hint moved into risk bar row above */}
      </CardContent>
    </Card>
  );
}
