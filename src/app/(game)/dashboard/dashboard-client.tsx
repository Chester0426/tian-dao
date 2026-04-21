"use client";

import { useEffect, useState } from "react";
import { useGameState } from "@/components/mining-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trackActivate, trackRetainReturn } from "@/lib/events";
import type { Profile, MiningSkill, MineMastery, InventoryItem } from "@/lib/types";
import { getRealmLevelLabel, qiBaseRate } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { BreakthroughDialog } from "./breakthrough-dialog";
import { QiCard } from "./qi-card";

interface OfflineRewards {
  minutesAway: number;
  drops: { item_type: string; quantity: number }[];
  xpGained: { mining: number; mastery: number; body: number };
  bodyProgress: string;
}

interface DashboardClientProps {
  profile: Profile;
  miningSkill: MiningSkill;
  masteries: MineMastery[];
  inventory: InventoryItem[];
  offlineRewards: OfflineRewards | null;
  stageName: string;
  xpProgress: number;
  xpCurrent: number;
  xpRequired: number;
  isBreakthroughReady: boolean;
  slotsUsed: number;
  totalSlots: number;
  isPostBodyTempering: boolean;
  bodySkillLevel: number;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

const REALMS_DISPLAY = [
  { id: "煉體", nameZh: "煉體期", nameEn: "Body Refining Realm" },
  { id: "練氣", nameZh: "練氣期", nameEn: "Qi Condensation Realm" },
  { id: "築基", nameZh: "築基期", nameEn: "Foundation Establishment Realm" },
  { id: "金丹", nameZh: "金丹期", nameEn: "Golden Core Realm" },
  { id: "元嬰", nameZh: "元嬰期", nameEn: "Nascent Soul Realm" },
];

export function DashboardClient({
  profile,
  xpProgress,
  xpCurrent,
  xpRequired,
  isPostBodyTempering,
  bodySkillLevel,
}: DashboardClientProps) {
  const gameState = useGameState();
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const currentRealmIdx = REALMS_DISPLAY.findIndex((r) => r.id === profile.realm);
  const currentLevel = profile.realm === "煉體" ? profile.body_level : profile.realm_level;

  const liveBodyXp = gameState.bodyXp ?? xpCurrent;
  const liveXpProgress = xpRequired > 0 ? Math.min((liveBodyXp / xpRequired) * 100, 100) : xpProgress;

  // Breakthrough logic only applies to 煉體 (other realms have their own systems)
  const isInBodyTempering = profile.realm === "煉體";
  const peakLevel = isInBodyTempering ? 9 : profile.realm === "練氣" ? 13 : 5;
  const isPeakToNextRealm = isInBodyTempering && currentLevel >= peakLevel && currentRealmIdx < REALMS_DISPLAY.length - 1;
  const liveBreakthroughReady = isInBodyTempering && !isPeakToNextRealm && liveXpProgress >= 100;
  const canBreakToNextRealm = isPeakToNextRealm && liveXpProgress >= 100;

  const [showBreakthrough, setShowBreakthrough] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("xian_body_collapsed");
      if (v === "1") setBodyCollapsed(true);
    } catch {}
  }, []);
  const toggleBodyCollapsed = () => {
    setBodyCollapsed((v) => {
      const nv = !v;
      try { localStorage.setItem("xian_body_collapsed", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };

  useEffect(() => {
    const hasVisited = localStorage.getItem("xian_dashboard_visited");
    if (!hasVisited) {
      trackActivate({ action: "entered_dashboard" });
      localStorage.setItem("xian_dashboard_visited", "true");
    }
  }, []);

  useEffect(() => {
    try {
      const lastVisit = localStorage.getItem("xian_last_dashboard_visit");
      if (lastVisit) {
        const days = Math.floor((Date.now() - Number(lastVisit)) / 86_400_000);
        if (days >= 1) trackRetainReturn({ days_since_last: days });
      }
      localStorage.setItem("xian_last_dashboard_visit", String(Date.now()));
    } catch {}
  }, []);

  useEffect(() => { setMounted(true); }, []);

  const levelLabel = getRealmLevelLabel(profile.realm, currentLevel, locale);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <header
          className="mb-6"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.5s ease-out",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src="/images/nav-items/nav-dashboard.png" alt="" className="h-12 w-12 object-contain" />
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  {isZh ? "境界" : "Realm"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isZh ? "修煉突破，踏上更高境界" : "Cultivate and break through to higher realms"}
              </p>
            </div>
            <Badge variant="outline" className="font-heading text-white border-jade/40 bg-jade px-3 py-1.5 text-sm">
              {isZh ? (REALMS_DISPLAY.find(r => r.id === profile.realm)?.nameZh ?? profile.realm) : (REALMS_DISPLAY.find(r => r.id === profile.realm)?.nameEn ?? profile.realm)} · {levelLabel}
            </Badge>
          </div>
          <div className="relative mt-4">
            <Separator />
            <div
              className="absolute left-0 top-0 h-[2px] bg-gradient-to-r from-cinnabar via-spirit-gold to-transparent"
              style={{
                width: mounted ? "40%" : "0%",
                transition: "width 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s",
              }}
            />
          </div>
        </header>

        {/* Realm Progress Map */}
        <div
          className="mb-6 flex items-center gap-1 overflow-x-auto pb-2"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.5s ease-out 0.2s",
          }}
        >
          {REALMS_DISPLAY.map((realm, idx) => {
            const isActive = idx === currentRealmIdx;
            const isPast = idx < currentRealmIdx;
            const isFuture = idx > currentRealmIdx;
            return (
              <div key={realm.id} className="flex items-center">
                {idx > 0 && (
                  <div className={`h-px w-4 sm:w-8 ${isPast ? "bg-spirit-gold/50" : "bg-border/30"}`} />
                )}
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-heading transition-all ${
                    isActive
                      ? "bg-spirit-gold/15 text-spirit-gold border border-spirit-gold/30"
                      : isPast
                        ? "bg-muted/30 text-muted-foreground"
                        : "bg-muted/10 text-muted-foreground/40"
                  }`}
                >
                  {isPast && <span className="text-spirit-gold/60">✓</span>}
                  {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-spirit-gold animate-pulse" />}
                  {isFuture && <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />}
                  <span>{isZh ? realm.nameZh : realm.nameEn}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Realm Card (練氣) */}
        {profile.realm === "練氣" && (
          <QiCard profile={profile} mounted={mounted} onBreakthroughClick={() => setShowBreakthrough(true)} />
        )}
        {/* Body Tempering (煉體) Card */}
        <Card
          className={`scroll-surface transition-all duration-300 ${(!isPostBodyTempering && (liveBreakthroughReady || canBreakToNextRealm)) ? "qi-glow" : ""}`}
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "scale(1)" : "scale(0.96)",
            transition: "all 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s",
          }}
        >
          <CardContent className={bodyCollapsed ? "pt-1 pb-2" : "pt-1 space-y-5"}>
            {/* Title row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-heading text-xl font-bold">
                  {isZh ? "煉體期" : "Body Refining Realm"} <span className="text-spirit-gold">{getRealmLevelLabel("煉體", profile.body_level, locale)}</span>
                </h2>
                {!bodyCollapsed && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {profile.body_level >= 10
                      ? (isZh ? "繼續淬煉肉體獲得更加強大的能力" : "Continue tempering for greater power")
                      : (isZh ? "強化肉體 — 透過挖礦或戰鬥淬煉肉體" : "Strengthen your body through mining or combat")}
                  </p>
                )}
              </div>
              {/* Eye toggle — hide/show body detail */}
              <button
                type="button"
                onClick={toggleBodyCollapsed}
                aria-label={bodyCollapsed ? (isZh ? "顯示詳細" : "Show details") : (isZh ? "隱藏詳細" : "Hide details")}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {bodyCollapsed ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              {!bodyCollapsed && liveBreakthroughReady && (
                <Button
                  onClick={() => setShowBreakthrough(true)}
                  className="seal-glow animate-pulse hover:animate-none hover:scale-[1.02] transition-transform font-heading"
                  size="lg"
                >
                  {isZh ? "突破" : "Break Through"}
                </Button>
              )}
              {!bodyCollapsed && canBreakToNextRealm && (
                <Button
                  onClick={() => setShowBreakthrough(true)}
                  className="seal-glow animate-pulse hover:animate-none hover:scale-[1.02] transition-transform font-heading bg-jade hover:bg-jade/90"
                  size="lg"
                >
                  {isZh ? `突破至${REALMS_DISPLAY[currentRealmIdx + 1]?.nameZh ?? "下一境界"}` : `Break to ${REALMS_DISPLAY[currentRealmIdx + 1]?.nameEn ?? "Next Realm"}`}
                </Button>
              )}
            </div>

            {!bodyCollapsed && (<>
            {/* XP Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{isZh ? "修煉進度" : "Progress"}</span>
                <span className="font-heading tabular-nums text-foreground">
                  {formatNumber(liveBodyXp)} / {formatNumber(xpRequired)}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cinnabar to-spirit-gold transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(liveXpProgress, 100)}%` }}
                />
                {liveXpProgress > 5 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full opacity-40"
                    style={{
                      width: `${Math.min(liveXpProgress, 100)}%`,
                      background: "linear-gradient(90deg, transparent 60%, oklch(1 0 0 / 20%) 100%)",
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.min(Math.round(liveXpProgress), 100)}%{liveXpProgress > 100 && ` (${isZh ? "溢出" : "overflow"} ${formatNumber(liveBodyXp - xpRequired)})`}
                </span>
                {(liveBreakthroughReady || canBreakToNextRealm) && (
                  <span className="text-xs font-medium text-spirit-gold animate-pulse text-glow-gold">
                    {isZh ? "可以突破了！" : "Ready to break through!"}
                  </span>
                )}
              </div>
            </div>

            {/* Breakthrough info */}
            <div className="rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
              {isPeakToNextRealm ? (
                <>
                  <p className="text-xs font-medium text-spirit-gold mb-2">{isZh ? "累積成長" : "Total Growth"}</p>
                  <div className="flex gap-4 text-xs mb-3">
                    <span className="text-red-400">{isZh ? "氣血" : "HP"} <span className="font-heading">+{(profile.body_level - 1) * 10}</span></span>
                    <span className="text-spirit-gold">{isZh ? "外功" : "ATK"} <span className="font-heading">+{profile.body_level - 1}</span></span>
                    <span className="text-white/70">{isZh ? "防禦" : "DEF"} <span className="font-heading">+{profile.body_level - 1}</span></span>
                  </div>
                  <p className="text-xs font-medium text-spirit-gold mb-2">{isZh ? `突破至 ${REALMS_DISPLAY[currentRealmIdx + 1]?.nameZh ?? "下一境界"}` : `Break to ${REALMS_DISPLAY[currentRealmIdx + 1]?.nameEn ?? "Next Realm"}`}</p>
                  <div className="flex gap-4 text-xs mb-2">
                    <span className="text-red-400">{isZh ? "氣血" : "HP"} <span className="font-heading">+100</span></span>
                    <span className="text-blue-400">{isZh ? "法力" : "MP"} <span className="font-heading">+10</span></span>
                    <span className="text-purple-400">{isZh ? "內功" : "Internal Power"} <span className="font-heading">+1</span></span>
                  </div>
                  <p className="text-xs text-jade">{isZh ? "解鎖：煉丹、煉器、煉體巔峰系統" : "Unlock: Alchemy, Smithing, Body Refining Peak System"}</p>
                </>
              ) : (
                <>
                  {profile.body_level > 1 && (
                    <>
                      <p className="text-xs font-medium text-spirit-gold mb-2">{isZh ? "累積成長" : "Total Growth"}</p>
                      <div className="flex gap-4 text-xs mb-2">
                        <span className="text-red-400">{isZh ? "氣血" : "HP"} <span className="font-heading">+{(profile.body_level - 1) * 10}</span></span>
                        <span className="text-spirit-gold">{isZh ? "外功" : "ATK"} <span className="font-heading">+{profile.body_level - 1}</span></span>
                        <span className="text-white/70">{isZh ? "防禦" : "DEF"} <span className="font-heading">+{profile.body_level - 1}</span></span>
                      </div>
                      {isPostBodyTempering && (
                        <p className="text-xs text-jade mb-3">{isZh ? "已解鎖：煉丹、煉器、煉體巔峰系統" : "Unlocked: Alchemy, Smithing, Body Refining Peak System"}</p>
                      )}
                      {!isPostBodyTempering && <div className="mb-3" />}
                    </>
                  )}
                  <p className="text-xs font-medium text-muted-foreground mb-2">{isZh ? "每級突破成長" : "Per Level Growth"}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-red-400">{isZh ? "氣血" : "HP"} <span className="font-heading">+10</span></span>
                    <span className="text-spirit-gold">{isZh ? "外功" : "ATK"} <span className="font-heading">+1</span></span>
                    <span className="text-white/70">{isZh ? "防禦" : "DEF"} <span className="font-heading">+1</span></span>
                  </div>
                </>
              )}
            </div>
            </>)}
          </CardContent>
        </Card>
      </div>

      {/* Breakthrough Dialog */}
      {showBreakthrough && (() => {
        const isQi = profile.realm === "練氣";
        const qiLvl = profile.qi_level || 1;
        const qiFailBonus = (profile.qi_fail_bonus ?? {})[String(qiLvl)] ?? 0;
        const qiRate = Math.min(100, qiBaseRate(qiLvl) + qiFailBonus);
        const qiIsPeak = isQi && qiLvl >= 13;
        return (
          <BreakthroughDialog
            currentStage={isQi ? qiLvl : currentLevel}
            currentRealm={profile.realm}
            nextRealm={
              qiIsPeak ? "築基"
              : isPeakToNextRealm ? REALMS_DISPLAY[currentRealmIdx + 1]?.id
              : undefined
            }
            isRealmTransition={qiIsPeak || isPeakToNextRealm}
            successRate={isQi ? qiRate : undefined}
            onCancel={() => setShowBreakthrough(false)}
          />
        );
      })()}
    </div>
  );
}
