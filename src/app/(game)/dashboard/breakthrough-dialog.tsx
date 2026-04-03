"use client";

import { useState, useEffect } from "react";
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
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function getLevelLabel(level: number): string {
  if (level >= 9) return `巔峰${level > 9 ? "+" + (level - 9) : ""}`;
  return `${level} 級`;
}

export function BreakthroughDialog({
  currentStage,
  onConfirm,
  onCancel,
}: BreakthroughDialogProps) {
  const [phase, setPhase] = useState<
    "confirm" | "breaking" | "success" | "demo_ended"
  >("confirm");
  const [open, setOpen] = useState(true);

  const currentName = `煉體期 ${getLevelLabel(currentStage)}`;
  const nextName = `煉體期 ${getLevelLabel(currentStage + 1)}`;

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleBreakthrough = async () => {
    setPhase("breaking");
    try {
      const res = await fetch("/api/game/breakthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "demo_ended") {
          await new Promise((r) => setTimeout(r, 800));
          setPhase("demo_ended");
          return;
        }
      }
      await onConfirm();
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1200));
    setPhase("success");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase === "confirm") {
          setOpen(false);
          onCancel();
        }
      }}
    >
      <DialogContent
        className={`sm:max-w-sm transition-all duration-500 ${
          phase === "breaking"
            ? "animate-[gold-breakthrough_1.2s_ease-in-out]"
            : phase === "success"
              ? "gold-shimmer"
              : ""
        }`}
        showCloseButton={phase === "confirm"}
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
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onCancel();
                }}
              >
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
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-spirit-gold animate-spin gold-shimmer" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-heading text-xl text-spirit-gold">突</span>
              </div>
            </div>
            <p className="mt-4 font-heading text-sm text-muted-foreground animate-pulse">
              突破中...
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
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setOpen(false);
                onCancel();
              }}
            >
              我知道了
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
