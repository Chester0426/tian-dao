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

const STAGE_NAMES: Record<number, string> = {
  1: "練體一階",
  2: "練體二階",
  3: "練體三階",
  4: "練體四階",
  5: "練體五階",
  6: "練體六階",
  7: "練體七階",
  8: "練體八階",
  9: "練體九階",
};

export function BreakthroughDialog({
  currentStage,
  onConfirm,
  onCancel,
}: BreakthroughDialogProps) {
  const [phase, setPhase] = useState<
    "confirm" | "breaking" | "success"
  >("confirm");
  const [open, setOpen] = useState(true);

  const nextStage = currentStage + 1;
  const currentName = STAGE_NAMES[currentStage] ?? `練體${currentStage}階`;
  const nextName =
    nextStage > 9
      ? "練體技能 (1-99)"
      : STAGE_NAMES[nextStage] ?? `練體${nextStage}階`;

  const isUnlockingSkillTrack = currentStage === 9;

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(() => {
        // Full reload to show new stage, reset XP, etc.
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleBreakthrough = async () => {
    setPhase("breaking");
    await onConfirm();
    // Brief delay for the animation
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
                {isUnlockingSkillTrack
                  ? "練體九階已圓滿，突破後將解鎖練體技能樹 (1-99)，繼續深化修煉。"
                  : `經驗已滿，可從 ${currentName} 突破至 ${nextName}。練體 1-9 階突破成功率 100%。`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div className="font-heading text-2xl text-muted-foreground">
                  {currentName}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-spirit-gold text-lg">→</span>
              </div>
              <div className="text-center">
                <div className="font-heading text-2xl text-spirit-gold text-glow-gold">
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
              {isUnlockingSkillTrack
                ? "練體技能樹已解鎖"
                : `已達 ${nextName}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
