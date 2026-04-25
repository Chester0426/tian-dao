"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface BreakthroughDialogProps {
  currentStage: number;
  currentRealm?: string;
  nextRealm?: string;
  isRealmTransition?: boolean;
  successRate?: number; // 0-100, undefined = always 100% (legacy body path)
  onCancel: () => void;
  onSuccess?: (data: { realm: string; new_level: number; leftover_xp: number }) => void;
  onResult?: (data: Record<string, unknown>) => void;
  flushAllPending?: () => void;
}

function getLevelLabel(level: number, realm: string = "煉體"): string {
  if (realm === "練氣") return level >= 13 ? "巔峰" : `${level} 級`;
  if (level >= 9) return `巔峰${level > 9 ? "+" + (level - 9) : ""}`;
  return `${level} 級`;
}

/* ─── Breakthrough Animation ───
 * 4-phase cultivation breakthrough sequence:
 * 1. Qi Gathering (聚氣) 0-30%   — particles spiral inward, soft gold aura
 * 2. Energy Condensing (凝元) 30-60% — brighter glow, orbiting particles, rune rings
 * 3. Critical Point (破關) 60-90% — shake, intense flashes, faster particles
 * 4. Breakthrough Burst (突破) 90-100% — explosive golden light, shockwave rings
 */

/* Particle config arrays — computed once outside React */
const SPIRAL_PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  delay: i * 0.5,
  startAngle: i * 60,
}));

const ORBIT_PARTICLES = Array.from({ length: 4 }, (_, i) => ({
  delay: i * 0.4,
  startAngle: i * 90,
}));

const SPARKLE_PARTICLES = Array.from({ length: 5 }, (_, i) => ({
  delay: i * 0.6,
  x: 30 + ((i * 37) % 40),
  y: 30 + ((i * 23) % 40),
}));

function BreakthroughAnimation({ progress }: { progress: number }) {
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const fillPct = Math.min(eased * 1.1, 1) * 100;

  /* Phase detection */
  const phase = progress < 0.3 ? 1 : progress < 0.6 ? 2 : progress < 0.9 ? 3 : 4;
  const phaseIntensity = phase === 1 ? progress / 0.3
    : phase === 2 ? (progress - 0.3) / 0.3
    : phase === 3 ? (progress - 0.6) / 0.3
    : 1;

  /* Aura opacity scales with phase */
  const auraOpacity = 0.15 + phase * 0.12;
  const auraScale = 1 + phase * 0.04;

  /* Shake for critical phase */
  const shakeActive = phase === 3;
  const shakeStyle = shakeActive ? {
    animation: `combat-hit-shake ${0.3 / (1 + phaseIntensity)}s ease-in-out infinite`,
  } : {};

  return (
    <div
      className="relative flex items-center justify-center mx-auto"
      style={{ width: 240, height: 240, ...shakeStyle }}
    >
      {/* Layer 2: Multi-layer aura pulse */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 240,
          height: 240,
          left: '50%',
          top: '50%',
          background: `radial-gradient(circle, rgba(212,166,67,${auraOpacity}) 0%, transparent 70%)`,
          animation: `qi-aura-pulse ${2 - phase * 0.3}s ease-in-out infinite`,
          transform: `translate(-50%, -50%) scale(${auraScale})`,
        }}
      />
      {/* Second aura ring — tighter, brighter */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 180,
          height: 180,
          left: '50%',
          top: '50%',
          background: `radial-gradient(circle, rgba(212,166,67,${auraOpacity * 0.7}) 0%, transparent 60%)`,
          animation: `qi-aura-pulse ${1.5 - phase * 0.2}s ease-in-out infinite reverse`,
          transform: `translate(-50%, -50%) scale(${auraScale * 0.95})`,
        }}
      />

      {/* Layer 3: Spiraling particles inward */}
      {SPIRAL_PARTICLES.map((p, i) => (
        <div
          key={`spiral-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 6 + phase,
            height: 6 + phase,
            left: '50%',
            top: '50%',
            background: `rgba(212,166,67,${0.6 + phase * 0.1})`,
            boxShadow: `0 0 ${4 + phase * 2}px rgba(212,166,67,0.5)`,
            animation: `qi-spiral-in ${3 - phase * 0.5}s linear infinite`,
            animationDelay: `${p.delay}s`,
            // @ts-expect-error CSS custom property
            '--start-angle': `${p.startAngle}deg`,
          }}
        />
      ))}

      {/* Layer 4: Orbiting glow particles (phase 2+) */}
      {phase >= 2 && ORBIT_PARTICLES.map((p, i) => (
        <div
          key={`orbit-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 8,
            height: 8,
            left: '50%',
            top: '50%',
            background: 'rgba(255,225,80,0.9)',
            boxShadow: '0 0 10px rgba(255,225,80,0.6)',
            animation: `qi-orbit-glow ${3 - phase * 0.4}s linear infinite`,
            animationDelay: `${p.delay}s`,
            // @ts-expect-error CSS custom property
            '--start-angle': `${p.startAngle}deg`,
          }}
        />
      ))}

      {/* Layer 5: Sparkle flashes */}
      {SPARKLE_PARTICLES.map((p, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute pointer-events-none"
          style={{
            width: 4,
            height: 4,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: 'rgba(255,240,120,0.9)',
            borderRadius: '50%',
            boxShadow: '0 0 6px rgba(255,240,120,0.6)',
            animation: `qi-sparkle ${2 - phase * 0.3}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Layer 6: Rotating rune rings SVG (phase 2+) */}
      {phase >= 2 && (
        <>
          <svg
            className="absolute pointer-events-none"
            width="220" height="220"
            viewBox="0 0 220 220"
            style={{
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `dao-ring-rotate ${12 - phase * 2}s linear infinite`,
              opacity: 0.3 + phaseIntensity * 0.3,
            }}
          >
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(212,166,67,0.25)" strokeWidth="0.5" strokeDasharray="8 12" />
            <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(212,166,67,0.15)" strokeWidth="0.5" strokeDasharray="4 16" />
            {/* Rune marks */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <text
                key={i}
                x="110" y="14"
                fill="rgba(212,166,67,0.35)"
                fontSize="8"
                textAnchor="middle"
                transform={`rotate(${angle} 110 110)`}
                fontFamily="serif"
              >
                {['道','氣','元','神','精','命','性','心'][i]}
              </text>
            ))}
          </svg>
          {/* Inner ring — counter-rotate */}
          <svg
            className="absolute pointer-events-none"
            width="180" height="180"
            viewBox="0 0 180 180"
            style={{
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `dao-ring-rotate-reverse ${10 - phase}s linear infinite`,
              opacity: 0.2 + phaseIntensity * 0.25,
            }}
          >
            <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(212,166,67,0.2)" strokeWidth="0.5" strokeDasharray="6 14" />
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <text
                key={i}
                x="90" y="14"
                fill="rgba(212,166,67,0.3)"
                fontSize="7"
                textAnchor="middle"
                transform={`rotate(${angle} 90 90)`}
                fontFamily="serif"
              >
                {['陰','陽','五行','八卦','天','地'][i]}
              </text>
            ))}
          </svg>
        </>
      )}

      {/* Dark figure — always visible */}
      <img
        src="/images/bt-figure.png" alt=""
        className="absolute inset-0 w-full h-full object-contain"
        style={{ width: 210, height: 210, left: 35, top: 35 }}
      />

      {/* Gold fill rising inside the figure — masked by the same shape */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 35, top: 35, width: 210, height: 210,
          WebkitMaskImage: "url(/images/bt-mask.png)",
          maskImage: "url(/images/bt-mask.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      >
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{
            height: `${fillPct}%`,
            background: phase >= 4
              ? "linear-gradient(to top, rgba(255,190,40,1) 0%, rgba(255,220,80,1) 30%, rgba(255,240,120,0.95) 60%, rgba(255,250,180,0.85) 100%)"
              : "linear-gradient(to top, rgba(255,170,20,1) 0%, rgba(255,200,50,0.85) 40%, rgba(255,225,80,0.7) 70%, rgba(255,240,120,0.5) 100%)",
          }}
        />
      </div>

      {/* Layer 7: Critical phase pulsing flash overlay */}
      {phase === 3 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(255,245,210,${0.15 + phaseIntensity * 0.2}) 0%, transparent 60%)`,
            animation: 'risk-pulse 0.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Layer 8: Burst phase — bright flash + shockwave rings */}
      {phase === 4 && (
        <>
          {/* Bright figure flash */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: 35, top: 35, width: 210, height: 210,
              WebkitMaskImage: "url(/images/bt-mask.png)",
              maskImage: "url(/images/bt-mask.png)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              background: `rgba(255,245,210,${0.4 + phaseIntensity * 0.3})`,
            }}
          />
          {/* Shockwave ring 1 */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 100, height: 100,
              left: '50%', top: '50%',
              border: '2px solid rgba(212,166,67,0.6)',
              boxShadow: '0 0 20px rgba(212,166,67,0.3)',
              animation: 'bt-shockwave 1.2s ease-out infinite',
            }}
          />
          {/* Shockwave ring 2 — delayed */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 100, height: 100,
              left: '50%', top: '50%',
              border: '2px solid rgba(212,166,67,0.4)',
              boxShadow: '0 0 16px rgba(212,166,67,0.2)',
              animation: 'bt-shockwave 1.2s ease-out infinite',
              animationDelay: '0.4s',
            }}
          />
          {/* Qi burst ring */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 60, height: 60,
              left: '50%', top: '50%',
              border: '1px solid rgba(255,225,80,0.5)',
              animation: 'combat-qi-burst 1.5s ease-out infinite',
            }}
          />
        </>
      )}
    </div>
  );
}

export function BreakthroughDialog({
  currentStage,
  currentRealm = "煉體",
  nextRealm,
  isRealmTransition = false,
  successRate,
  onCancel,
  onSuccess,
  onResult,
  flushAllPending,
}: BreakthroughDialogProps) {
  const [phase, setPhase] = useState<
    "confirm" | "breaking" | "success" | "failed" | "demo_ended"
  >("confirm");
  const [open, setOpen] = useState(true);
  const [animProgress, setAnimProgress] = useState(0);
  const [errorDetail, setErrorDetail] = useState("");
  const { locale } = useI18n();
  const isZh = locale === "zh";

  // Lock display text at mount time
  const [displayNames] = useState(() => {
    const realmNames: Record<string, { zh: string; en: string }> = {
      "煉體": { zh: "煉體期", en: "Body Refining Realm" },
      "練氣": { zh: "練氣期", en: "Qi Condensation Realm" },
      "築基": { zh: "築基期", en: "Foundation Establishment Realm" },
      "金丹": { zh: "金丹期", en: "Golden Core Realm" },
      "元嬰": { zh: "元嬰期", en: "Nascent Soul Realm" },
    };
    const realmName = realmNames[currentRealm] ?? { zh: currentRealm, en: currentRealm };
    const nextRealmName = nextRealm ? (realmNames[nextRealm] ?? { zh: nextRealm, en: nextRealm }) : null;
    const levelLabelEn = (lvl: number, r: string = "煉體") => {
      if (r === "練氣") return lvl >= 13 ? "Peak" : `Lv.${lvl}`;
      return lvl >= 9 ? `Peak${lvl > 9 ? "+" + (lvl - 9) : ""}` : `Lv.${lvl}`;
    };
    return {
      currentNameZh: `${realmName.zh} ${getLevelLabel(currentStage, currentRealm)}`,
      currentNameEn: `${realmName.en} ${levelLabelEn(currentStage, currentRealm)}`,
      nextNameZh: isRealmTransition && nextRealmName
        ? `${nextRealmName.zh} 1 級`
        : `${realmName.zh} ${getLevelLabel(currentStage + 1, currentRealm)}`,
      nextNameEn: isRealmTransition && nextRealmName
        ? `${nextRealmName.en} Lv.1`
        : `${realmName.en} ${levelLabelEn(currentStage + 1, currentRealm)}`,
    };
  });
  const currentName = isZh ? displayNames.currentNameZh : displayNames.currentNameEn;
  const nextName = isZh ? displayNames.nextNameZh : displayNames.nextNameEn;

  const handleClose = useCallback(() => {
    setOpen(false);
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(() => {
        setOpen(false);
        onCancel();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, onCancel]);

  const handleBreakthrough = async () => {
    setPhase("breaking");
    setAnimProgress(0);
    setErrorDetail("");

    const [apiResult] = await Promise.all([
      (async () => {
        // Flush all pending skill data before breakthrough
        if (flushAllPending) flushAllPending();
        return fetch("/api/game/breakthrough", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      })().then(async (res): Promise<{ phase: "success" | "failed" | "demo_ended"; data?: Record<string, unknown> }> => {
        const text = await res.text();
        if (res.ok) {
          try {
            const data = JSON.parse(text);
            if (data && data.success === false) {
              return { phase: "failed", data };
            }
            return { phase: "success", data };
          } catch {}
          return { phase: "success" };
        }
        try {
          const data = JSON.parse(text);
          if (data.error === "demo_ended") return { phase: "demo_ended" };
          setErrorDetail(`${res.status} ${data.error}${data.detail ? " - " + data.detail : ""}`);
        } catch {
          setErrorDetail(`${res.status} ${text.slice(0, 100)}`);
        }
        return { phase: "failed" };
      }).catch((err): { phase: "failed"; data?: Record<string, unknown> } => {
        setErrorDetail(`Network: ${err.message}`);
        return { phase: "failed" };
      }),
      // 3-second animation
      new Promise<void>((resolve) => {
        const start = Date.now();
        const duration = 4000;
        const frame = () => {
          const elapsed = Date.now() - start;
          const p = Math.min(elapsed / duration, 1);
          setAnimProgress(p);
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      }),
    ]);

    setPhase(apiResult.phase);
    if (apiResult.data && onResult) onResult(apiResult.data);
    if (apiResult.phase === "success" && onSuccess && apiResult.data) {
      onSuccess({
        realm: (apiResult.data.realm ?? apiResult.data.new_realm) as string,
        new_level: apiResult.data.new_level as number,
        leftover_xp: apiResult.data.leftover_xp as number,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase !== "breaking") {
          setOpen(false);
          onCancel();
        }
      }}
    >
      <DialogContent
        className={`transition-all duration-500 ${
          phase === "breaking" ? "sm:max-w-md" : "sm:max-w-sm"
        } ${phase === "success" ? "gold-shimmer" : ""}`}
        showCloseButton={false}
      >
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-spirit-gold text-glow-gold">
                {isZh ? "突破修煉" : "Break Through"}
              </DialogTitle>
              <DialogDescription>
                {isZh
                  ? `經驗已滿，突破成功率 ${successRate ?? 100}%`
                  : `XP full, ${successRate ?? 100}% success rate`}
                {typeof successRate === "number" && successRate < 100 && (
                  <span className="block mt-1 text-[11px] text-cinnabar/80">
                    {isZh ? "失敗將消耗經驗並永久提升 1% 成功率" : "Failure consumes XP and permanently adds +1%"}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-6 py-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground/60 mb-1">{isZh ? "當前" : "Current"}</p>
                <div className="font-heading text-xl text-muted-foreground">
                  {currentName}
                </div>
              </div>
              <div className="text-spirit-gold text-2xl">→</div>
              <div className="text-center">
                <p className="text-xs text-spirit-gold/60 mb-1">{isZh ? "突破後" : "After"}</p>
                <div className="font-heading text-xl text-spirit-gold text-glow-gold">
                  {nextName}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {isZh ? "稍後再說" : "Later"}
              </Button>
              <Button
                onClick={handleBreakthrough}
                className="seal-glow hover:scale-[1.02] transition-transform"
              >
                {isZh ? "開始突破" : "Begin Breakthrough"}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "breaking" && (
          <div className="flex flex-col items-center justify-center py-4 w-full overflow-hidden">
            <BreakthroughAnimation progress={animProgress} />
            <p className="mt-3 font-heading text-spirit-gold text-sm tracking-widest">
              {isZh
                ? animProgress < 0.3 ? "聚氣..."
                  : animProgress < 0.6 ? "凝元..."
                  : animProgress < 0.9 ? "破關..."
                  : "突破！"
                : animProgress < 0.3 ? "Gathering Qi..."
                  : animProgress < 0.6 ? "Condensing Energy..."
                  : animProgress < 0.9 ? "Breaking Through..."
                  : "Breakthrough!"}
            </p>
            {/* Subtle progress bar */}
            <div className="mt-2 w-40 h-1 rounded-full bg-spirit-gold/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${animProgress * 100}%`,
                  background: "linear-gradient(to right, rgba(212,166,67,0.6), rgba(255,225,80,0.9))",
                }}
              />
            </div>
          </div>
        )}

        {phase === "success" && (
          <div className="relative flex flex-col items-center justify-center py-8">
            {/* Radial gold aura background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(212,166,67,0.12) 0%, transparent 60%)',
              }}
            />
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-spirit-gold/20 gold-shimmer"
              style={{ animation: 'seal-stamp 0.5s ease-out forwards' }}
            >
              <span className="font-heading text-2xl text-spirit-gold">✓</span>
            </div>
            <p
              className="mt-4 font-heading text-lg text-spirit-gold text-glow-gold"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.2s both' }}
            >
              {isZh ? "突破成功！" : "Breakthrough Success!"}
            </p>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.4s both' }}
            >
              {isZh ? `已達 ${nextName}` : `Reached ${nextName}`}
            </p>
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.6s both' }}
            >
              {isZh ? "關閉" : "Close"}
            </button>
          </div>
        )}

        {phase === "failed" && (
          <div className="relative flex flex-col items-center justify-center py-8">
            {/* Dim cinnabar radial aura */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(180,60,40,0.08) 0%, transparent 60%)',
              }}
            />
            {/* Energy dissipation particles — reverse spiral outward */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <div
                key={`dissipate-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 4,
                  height: 4,
                  left: '50%',
                  top: '50%',
                  background: 'rgba(180,60,40,0.6)',
                  boxShadow: '0 0 4px rgba(180,60,40,0.3)',
                  animation: `qi-spiral-in 2s linear infinite reverse`,
                  animationDelay: `${i * 0.3}s`,
                  // @ts-expect-error CSS custom property
                  '--start-angle': `${angle}deg`,
                }}
              />
            ))}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-cinnabar/20"
              style={{ animation: 'seal-stamp 0.5s ease-out forwards' }}
            >
              <span className="font-heading text-2xl text-cinnabar">✗</span>
            </div>
            <p
              className="mt-4 font-heading text-lg text-cinnabar"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.2s both' }}
            >
              {isZh ? "突破失敗" : "Breakthrough Failed"}
            </p>
            <p
              className="mt-2 text-sm text-muted-foreground"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.4s both' }}
            >
              {isZh ? "修為不足，請繼續修煉" : "Insufficient cultivation, keep training"}
            </p>
            {errorDetail && (
              <p
                className="mt-1 text-xs text-muted-foreground/40 font-mono"
                style={{ animation: 'ink-fade-in 0.6s ease-out 0.5s both' }}
              >
                {errorDetail}
              </p>
            )}
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
              style={{ animation: 'ink-fade-in 0.6s ease-out 0.6s both' }}
            >
              {isZh ? "關閉" : "Close"}
            </button>
          </div>
        )}

        {phase === "demo_ended" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cinnabar/20">
              <span className="font-heading text-2xl text-cinnabar">封</span>
            </div>
            <p className="mt-4 font-heading text-lg text-foreground">
              {isZh ? "Demo 版本已結束" : "Demo Version Ended"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground text-center leading-relaxed">
              {isZh ? "正式版即將推出，敬請期待！" : "Full version coming soon!"}
            </p>
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              {isZh ? "關閉" : "Close"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
