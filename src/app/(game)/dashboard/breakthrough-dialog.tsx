"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BreakthroughDialogProps {
  currentStage: number;
  currentRealm?: string;
  nextRealm?: string;
  isRealmTransition?: boolean;
  onCancel: () => void;
}

function getLevelLabel(level: number): string {
  if (level >= 9) return `巔峰${level > 9 ? "+" + (level - 9) : ""}`;
  return `${level} 級`;
}

/* ─── Breakthrough Animation ───
 * Dark gray figure (transparent bg) visible from start.
 * Gold light fills the figure interior from bottom to top using CSS mask.
 * Mask is derived from the same image so shapes match perfectly.
 */
function BreakthroughAnimation({ progress }: { progress: number }) {
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const fillPct = Math.min(eased * 1.1, 1) * 100;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 210, height: 210 }}>
      {/* Dark figure — always visible from the start */}
      <img
        src="/images/bt-figure.png" alt=""
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Gold fill rising inside the figure — masked by the same shape */}
      <div
        className="absolute inset-0"
        style={{
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
            background: "linear-gradient(to top, rgba(255,170,20,1) 0%, rgba(255,200,50,0.85) 40%, rgba(255,225,80,0.7) 70%, rgba(255,240,120,0.5) 100%)",
          }}
        />
      </div>

      {/* Flash when fully filled */}
      {progress > 0.9 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            WebkitMaskImage: "url(/images/bt-mask.png)",
            maskImage: "url(/images/bt-mask.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            background: `rgba(255,245,210,${Math.max(0, (1 - (progress - 0.9) / 0.1) * 0.5)})`,
          }}
        />
      )}
    </div>
  );
}

export function BreakthroughDialog({
  currentStage,
  currentRealm = "煉體",
  nextRealm,
  isRealmTransition = false,
  onCancel,
}: BreakthroughDialogProps) {
  const [phase, setPhase] = useState<
    "confirm" | "breaking" | "success" | "failed" | "demo_ended"
  >("confirm");
  const [open, setOpen] = useState(true);
  const [animProgress, setAnimProgress] = useState(0);
  const [errorDetail, setErrorDetail] = useState("");
  const router = useRouter();

  // Lock display text at mount time
  const [displayNames] = useState(() => {
    const realmNames: Record<string, { zh: string; en: string }> = {
      "煉體": { zh: "煉體期", en: "Body Refining" },
      "練氣": { zh: "練氣期", en: "Qi Condensation" },
      "築基": { zh: "築基期", en: "Foundation" },
      "金丹": { zh: "金丹期", en: "Golden Core" },
      "元嬰": { zh: "元嬰期", en: "Nascent Soul" },
    };
    const crName = realmNames[currentRealm]?.zh ?? currentRealm;
    return {
      currentName: `${crName} ${getLevelLabel(currentStage)}`,
      nextName: isRealmTransition && nextRealm
        ? `${realmNames[nextRealm]?.zh ?? nextRealm} 1 級`
        : `${crName} ${getLevelLabel(currentStage + 1)}`,
    };
  });
  const { currentName, nextName } = displayNames;

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
      fetch("/api/game/breakthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then(async (res): Promise<"success" | "failed" | "demo_ended"> => {
        const text = await res.text();
        if (res.ok) {
          router.refresh();
          return "success";
        }
        try {
          const data = JSON.parse(text);
          if (data.error === "demo_ended") return "demo_ended";
          setErrorDetail(`${res.status} ${data.error}${data.detail ? " - " + data.detail : ""}`);
        } catch {
          setErrorDetail(`${res.status} ${text.slice(0, 100)}`);
        }
        return "failed";
      }).catch((err): "failed" => {
        setErrorDetail(`Network: ${err.message}`);
        return "failed";
      }),
      // 5-second animation
      new Promise<void>((resolve) => {
        const start = Date.now();
        const duration = 3000;
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

    setPhase(apiResult);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase !== "breaking") {
          setOpen(false);
          if (phase === "success") window.location.reload();
          else onCancel();
        }
      }}
    >
      <DialogContent
        className={`sm:max-w-sm transition-all duration-500 ${
          phase === "success" ? "gold-shimmer" : ""
        }`}
        showCloseButton={false}
      >
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-spirit-gold text-glow-gold">
                突破修煉
              </DialogTitle>
              <DialogDescription>
                經驗已滿，突破成功率 100%
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-6 py-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground/60 mb-1">當前</p>
                <div className="font-heading text-xl text-muted-foreground">
                  {currentName}
                </div>
              </div>
              <div className="text-spirit-gold text-2xl">→</div>
              <div className="text-center">
                <p className="text-xs text-spirit-gold/60 mb-1">突破後</p>
                <div className="font-heading text-xl text-spirit-gold text-glow-gold">
                  {nextName}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                稍後再說
              </Button>
              <Button
                onClick={handleBreakthrough}
                className="seal-glow hover:scale-[1.02] transition-transform"
              >
                開始突破
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "breaking" && (
          <div className="flex flex-col items-center justify-center py-4">
            <BreakthroughAnimation progress={animProgress} />
            <p className="mt-3 font-heading text-spirit-gold/80 text-sm tracking-widest animate-pulse">
              突破中
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-spirit-gold/20 gold-shimmer">
              <span className="font-heading text-2xl text-spirit-gold">✓</span>
            </div>
            <p className="mt-4 font-heading text-lg text-spirit-gold text-glow-gold">
              突破成功！
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              已達 {nextName}
            </p>
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              關閉
            </button>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cinnabar/20">
              <span className="font-heading text-2xl text-cinnabar">✗</span>
            </div>
            <p className="mt-4 font-heading text-lg text-cinnabar">
              突破失敗
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              修為不足，請繼續修煉
            </p>
            {errorDetail && (
              <p className="mt-1 text-xs text-muted-foreground/40 font-mono">
                {errorDetail}
              </p>
            )}
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              關閉
            </button>
          </div>
        )}

        {phase === "demo_ended" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cinnabar/20">
              <span className="font-heading text-2xl text-cinnabar">封</span>
            </div>
            <p className="mt-4 font-heading text-lg text-foreground">
              Demo 版本已結束
            </p>
            <p className="mt-2 text-sm text-muted-foreground text-center leading-relaxed">
              正式版即將推出，敬請期待！
            </p>
            <button
              onClick={handleClose}
              className="mt-5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              關閉
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
