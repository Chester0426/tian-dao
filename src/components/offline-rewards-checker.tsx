"use client";

import { useEffect, useState } from "react";
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

interface OfflineRewardsData {
  minutes_away: number;
  total_actions: number;
  drops: { item_type: string; quantity: number }[];
  xp_gained: { mining: number; mastery: number; body: number };
}

export function OfflineRewardsChecker({ hasActiveSession }: { hasActiveSession: boolean }) {
  const { resumeAfterOfflineRewards } = useGameState();
  const [rewards, setRewards] = useState<OfflineRewardsData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasActiveSession || checked) return;

    // Check if we already showed rewards this session
    const lastCheck = sessionStorage.getItem("offline-rewards-checked");
    if (lastCheck) {
      setChecked(true);
      resumeAfterOfflineRewards(); // Already checked this session, resume mining
      return;
    }

    // Call offline rewards API
    fetch("/api/game/offline-rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.total_actions > 0) {
          setRewards(data);
          // Don't resume yet — user must click "領取完畢"
        } else {
          // No offline rewards — resume mining immediately
          resumeAfterOfflineRewards();
        }
        sessionStorage.setItem("offline-rewards-checked", Date.now().toString());
        setChecked(true);
      })
      .catch(() => {
        setChecked(true);
      });
  }, [hasActiveSession, checked]);

  if (!rewards) return null;

  return (
    <Dialog open={!!rewards} onOpenChange={() => setRewards(null)}>
      <DialogContent className="scroll-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">離線收益</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            你離開了{" "}
            <span className="text-foreground font-medium">
              {rewards.minutes_away >= 60
                ? `${Math.floor(rewards.minutes_away / 60)} 小時 ${rewards.minutes_away % 60} 分鐘`
                : `${rewards.minutes_away} 分鐘`}
            </span>
            ，期間共挖礦{" "}
            <span className="text-foreground font-medium tabular-nums">
              {rewards.total_actions.toLocaleString()}
            </span>{" "}
            次
          </p>

          {rewards.drops.length > 0 && (
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                獲得物品
              </h3>
              {rewards.drops.map((drop) => (
                <div key={drop.item_type} className="flex items-center justify-between text-sm">
                  <span>{ITEM_NAMES[drop.item_type] ?? drop.item_type}</span>
                  <span className="tabular-nums text-muted-foreground">
                    x{drop.quantity.toLocaleString()}
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
              <span>挖礦</span>
              <span className="tabular-nums">+{rewards.xp_gained.mining.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>精通</span>
              <span className="tabular-nums">+{rewards.xp_gained.mastery.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>練體</span>
              <span className="tabular-nums">+{rewards.xp_gained.body.toLocaleString()}</span>
            </div>
          </div>

          <Button className="w-full seal-glow font-heading" onClick={() => { setRewards(null); resumeAfterOfflineRewards(); }}>
            領取完畢
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
