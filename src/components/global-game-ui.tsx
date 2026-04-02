"use client";

import { useGameState } from "@/components/mining-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

const ITEM_INFO: Record<string, { name: string; icon: string; color: string }> = {
  coal: { name: "煤", icon: "◆", color: "text-foreground" },
  copper_ore: { name: "銅礦", icon: "◇", color: "text-jade" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "✦", color: "text-spirit-gold" },
};

export function GlobalGameUI() {
  const { notifications, pendingOfflineRewards, dismissOfflineRewards } = useGameState();

  return (
    <>
      {/* === System 1: Global floating notifications === */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-lg bg-card/95 border border-border/50 px-3 py-1.5 text-sm backdrop-blur-sm shadow-lg"
              style={{ animation: "drop-float-up 2.5s ease-out forwards" }}
            >
              <span className={`text-base ${n.color}`}>{n.icon}</span>
              <span className={`font-bold tabular-nums ${n.color}`}>+{n.amount}</span>
              <span className="text-muted-foreground">{n.label}</span>
              {n.total !== undefined && (
                <span className="text-xs tabular-nums text-muted-foreground/60">{n.total.toLocaleString()}個</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === System 2: Melvor-style offline rewards dialog === */}
      <Dialog open={!!pendingOfflineRewards} onOpenChange={() => {}}>
        <DialogContent className="scroll-surface sm:max-w-sm" showCloseButton={false}>
          {pendingOfflineRewards && (
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              {/* Icon */}
              <img src="/images/logo-dao.png" alt="" className="h-16 w-16 rounded-xl" />

              {/* Welcome back */}
              <h2 className="font-heading text-2xl font-bold">
                歡迎回來！
              </h2>

              {/* Time away */}
              <div className="space-y-1">
                <p className="text-base text-foreground">
                  你離開了大約{" "}
                  <span className="font-bold">
                    {pendingOfflineRewards.minutes_away >= 60
                      ? `${Math.floor(pendingOfflineRewards.minutes_away / 60)} 小時 ${pendingOfflineRewards.minutes_away % 60} 分鐘`
                      : `${pendingOfflineRewards.minutes_away} 分鐘`}
                  </span>
                </p>
                <p className="text-sm text-jade">
                  (12 小時為離線進度的最大上限)
                </p>
              </div>

              {/* Rewards section */}
              <div className="space-y-3 w-full">
                <p className="text-sm text-muted-foreground">在你離開時：</p>

                {/* Mining XP */}
                {pendingOfflineRewards.xp_gained.mining > 0 && (
                  <p className="text-base">
                    你獲得了{" "}
                    <span className="font-bold text-blue-400 tabular-nums">
                      {pendingOfflineRewards.xp_gained.mining.toLocaleString()}
                    </span>
                    {" "}點挖礦技能經驗值
                  </p>
                )}

                {/* Body XP */}
                {pendingOfflineRewards.xp_gained.body > 0 && (
                  <p className="text-base">
                    你獲得了{" "}
                    <span className="font-bold text-spirit-gold tabular-nums">
                      {pendingOfflineRewards.xp_gained.body.toLocaleString()}
                    </span>
                    {" "}點煉體經驗值
                  </p>
                )}

                {/* Items */}
                {Object.entries(pendingOfflineRewards.drops).map(([itemType, qty]) => {
                  const info = ITEM_INFO[itemType];
                  return (
                    <p key={itemType} className="text-base">
                      你獲得了{" "}
                      <span className={`font-bold tabular-nums ${info?.color ?? "text-foreground"}`}>
                        {(qty as number).toLocaleString()}
                      </span>
                      {" "}個{" "}
                      <span className={info?.color ?? ""}>{info?.icon ?? "○"}</span>
                      {" "}
                      <span className="font-medium">{info?.name ?? itemType}</span>
                    </p>
                  );
                })}
              </div>

              {/* Claim button */}
              <Button
                className="w-full max-w-[200px] seal-glow font-heading text-base py-5"
                onClick={dismissOfflineRewards}
              >
                好的
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
