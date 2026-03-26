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
  1: "\u7DF4\u9AD4\u4E00\u968E",
  2: "\u7DF4\u9AD4\u4E8C\u968E",
  3: "\u7DF4\u9AD4\u4E09\u968E",
  4: "\u7DF4\u9AD4\u56DB\u968E",
  5: "\u7DF4\u9AD4\u4E94\u968E",
  6: "\u7DF4\u9AD4\u516D\u968E",
  7: "\u7DF4\u9AD4\u4E03\u968E",
  8: "\u7DF4\u9AD4\u516B\u968E",
  9: "\u7DF4\u9AD4\u4E5D\u968E",
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
  const currentName = STAGE_NAMES[currentStage] ?? `\u7DF4\u9AD4${currentStage}\u968E`;
  const nextName =
    nextStage > 9
      ? "\u7DF4\u9AD4\u6280\u80FD (1-99)"
      : STAGE_NAMES[nextStage] ?? `\u7DF4\u9AD4${nextStage}\u968E`;

  const isUnlockingSkillTrack = currentStage === 9;

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(() => {
        setOpen(false);
        onCancel();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, onCancel]);

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
                \u7A81\u7834\u4FEE\u7149
              </DialogTitle>
              <DialogDescription>
                {isUnlockingSkillTrack
                  ? "\u7DF4\u9AD4\u4E5D\u968E\u5DF2\u5713\u6EFF\uFF0C\u7A81\u7834\u5F8C\u5C07\u89E3\u9396\u7DF4\u9AD4\u6280\u80FD\u6A39 (1-99)\uFF0C\u7E7C\u7E8C\u6DF1\u5316\u4FEE\u7149\u3002"
                  : `\u7D93\u9A57\u5DF2\u6EFF\uFF0C\u53EF\u5F9E ${currentName} \u7A81\u7834\u81F3 ${nextName}\u3002\u7DF4\u9AD4 1-9 \u968E\u7A81\u7834\u6210\u529F\u7387 100%\u3002`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div className="font-heading text-2xl text-muted-foreground">
                  {currentName}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-spirit-gold text-lg">\u2192</span>
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
                \u7A0D\u5F8C\u518D\u8AAA
              </Button>
              <Button
                onClick={handleBreakthrough}
                className="seal-glow hover:scale-[1.02] transition-transform"
              >
                \u958B\u59CB\u7A81\u7834
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "breaking" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-spirit-gold animate-spin gold-shimmer" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-heading text-xl text-spirit-gold">\u7A81</span>
              </div>
            </div>
            <p className="mt-4 font-heading text-sm text-muted-foreground animate-pulse">
              \u7A81\u7834\u4E2D...
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-spirit-gold/20 gold-shimmer">
              <span className="font-heading text-2xl text-spirit-gold">\u2713</span>
            </div>
            <p className="mt-4 font-heading text-lg text-spirit-gold text-glow-gold">
              \u7A81\u7834\u6210\u529F\uFF01
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isUnlockingSkillTrack
                ? "\u7DF4\u9AD4\u6280\u80FD\u6A39\u5DF2\u89E3\u9396"
                : `\u5DF2\u9054 ${nextName}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
