"use client";

import { useGameState } from "@/components/mining-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ITEM_NAMES: Record<string, string> = {
  coal: "煤",
  copper_ore: "銅礦",
  spirit_stone_fragment: "靈石碎片",
};

export function VisibilityRewardsDialog() {
  const { pendingVisibilityRewards, dismissVisibilityRewards } = useGameState();

  if (!pendingVisibilityRewards) return null;

  const { minutes_away, total_actions, drops, xp_gained } = pendingVisibilityRewards;

  return (
    <Dialog open={true} onOpenChange={() => dismissVisibilityRewards()}>
      <DialogContent className="scroll-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">離線收益</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            你離開了{" "}
            <span className="text-foreground font-medium">
              {minutes_away >= 60
                ? `${Math.floor(minutes_away / 60)} 小時 ${minutes_away % 60} 分鐘`
                : `${minutes_away} 分鐘`}
            </span>
            ，期間共挖礦{" "}
            <span className="text-foreground font-medium tabular-nums">
              {total_actions.toLocaleString()}
            </span>{" "}
            次
          </p>

          {Object.keys(drops).length > 0 && (
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                獲得物品
              </h3>
              {Object.entries(drops).map(([itemType, qty]) => (
                <div key={itemType} className="flex items-center justify-between text-sm">
                  <span>{ITEM_NAMES[itemType] ?? itemType}</span>
                  <span className="tabular-nums text-muted-foreground">
                    x{qty.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              經驗獲得
            </h3>
            <div className="flex justify-between text-sm">
              <span>⛏ 挖礦</span>
              <span className="tabular-nums">+{xp_gained.mining.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🏆 精通</span>
              <span className="tabular-nums">+{xp_gained.mastery.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>💪 練體</span>
              <span className="tabular-nums">+{xp_gained.body.toLocaleString()}</span>
            </div>
          </div>

          <Button
            className="w-full seal-glow font-heading"
            onClick={dismissVisibilityRewards}
          >
            領取完畢
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
