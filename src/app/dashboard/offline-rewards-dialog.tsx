"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Item display name mapping
const ITEM_NAMES: Record<string, string> = {
  "\u7164": "Coal",
  "\u9285\u7926": "Copper Ore",
  "\u9748\u77F3\u7897\u7247": "Spirit Stone Fragment",
};

// Item icon mapping (ink-wash style descriptors)
const ITEM_ICONS: Record<string, string> = {
  "\u7164": "\u25C6",
  "\u9285\u7926": "\u25C7",
  "\u9748\u77F3\u7897\u7247": "\u2726",
};

interface OfflineRewards {
  minutesAway: number;
  drops: { item_type: string; quantity: number }[];
  xpGained: {
    mining: number;
    mastery: number;
    body: number;
  };
  bodyProgress: string;
}

interface OfflineRewardsDialogProps {
  rewards: OfflineRewards;
  onDismiss: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} \u5206\u9418`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} \u5C0F\u6642`;
  return `${hours} \u5C0F\u6642 ${mins} \u5206\u9418`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function OfflineRewardsDialog({
  rewards,
  onDismiss,
}: OfflineRewardsDialogProps) {
  const [open, setOpen] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    // Simulate collect animation delay
    await new Promise((r) => setTimeout(r, 800));
    setCollected(true);
    setTimeout(() => {
      setOpen(false);
      onDismiss();
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false);
          onDismiss();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg text-spirit-gold text-glow-gold">
            \u96E2\u7DDA\u4FEE\u7149\u6210\u679C
          </DialogTitle>
          <DialogDescription>
            \u4F60\u96E2\u958B\u4E86{" "}
            <span className="font-medium text-foreground">
              {formatDuration(rewards.minutesAway)}
            </span>
            \uFF0C\u4FEE\u7149\u5F9E\u672A\u505C\u6B47\u3002
          </DialogDescription>
        </DialogHeader>

        {/* Drops section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              \u7372\u5F97\u7269\u54C1
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {rewards.drops.map((drop) => (
              <div
                key={drop.item_type}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none text-jade">
                    {ITEM_ICONS[drop.item_type] ?? "\u25CB"}
                  </span>
                  <span className="text-sm font-medium">
                    {drop.item_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ITEM_NAMES[drop.item_type] ?? ""}
                  </span>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  +{formatNumber(drop.quantity)}
                </Badge>
              </div>
            ))}
            {rewards.drops.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                \u7121\u7269\u54C1\u6536\u7372
              </div>
            )}
          </div>
        </div>

        {/* XP section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              \u7D93\u9A57\u7372\u5F97
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">\u63A1\u7926\u6280\u80FD</div>
              <div className="mt-1 font-heading text-sm font-bold text-jade tabular-nums">
                +{formatNumber(rewards.xpGained.mining)}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">\u7CBE\u901A\u5EA6</div>
              <div className="mt-1 font-heading text-sm font-bold text-jade tabular-nums">
                +{formatNumber(rewards.xpGained.mastery)}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">\u7DF4\u9AD4</div>
              <div className="mt-1 font-heading text-sm font-bold text-cinnabar tabular-nums">
                +{formatNumber(rewards.xpGained.body)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleCollect}
            disabled={collecting || collected}
            className={`w-full transition-all duration-300 ${
              collected
                ? "bg-jade text-jade-foreground gold-shimmer"
                : "seal-glow hover:scale-[1.02]"
            }`}
            size="lg"
          >
            {collected ? "\u2713 \u5DF2\u6536\u53D6" : collecting ? "\u6536\u53D6\u4E2D..." : "\u6536\u53D6\u4FEE\u7149\u6210\u679C"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
