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
  "煤": "Coal",
  "銅礦": "Copper Ore",
  "靈石碗片": "Spirit Stone Fragment",
};

// Item icon mapping (ink-wash style descriptors)
const ITEM_ICONS: Record<string, string> = {
  "煤": "◆",
  "銅礦": "◇",
  "靈石碗片": "✦",
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
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} 小時`;
  return `${hours} 小時 ${mins} 分鐘`;
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
            離線修煉成果
          </DialogTitle>
          <DialogDescription>
            你離開了{" "}
            <span className="font-medium text-foreground">
              {formatDuration(rewards.minutesAway)}
            </span>
            ，修煉從未停歇。
          </DialogDescription>
        </DialogHeader>

        {/* Drops section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              獲得物品
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
                    {ITEM_ICONS[drop.item_type] ?? "○"}
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
                無物品收獲
              </div>
            )}
          </div>
        </div>

        {/* XP section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              經驗獲得
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">挖礦技能</div>
              <div className="mt-1 font-heading text-sm font-bold text-jade tabular-nums">
                +{formatNumber(rewards.xpGained.mining)}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">精通度</div>
              <div className="mt-1 font-heading text-sm font-bold text-jade tabular-nums">
                +{formatNumber(rewards.xpGained.mastery)}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">練體</div>
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
            {collected ? "✓ 已收取" : collecting ? "收取中..." : "收取修煉成果"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
