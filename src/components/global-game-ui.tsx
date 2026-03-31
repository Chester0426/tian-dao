"use client";

import { useGameState } from "@/components/mining-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

      {/* === System 2: Unified offline rewards dialog === */}
      <Dialog open={!!pendingOfflineRewards} onOpenChange={() => {}}>
        <DialogContent className="scroll-surface sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">離線收益</DialogTitle>
          </DialogHeader>
          {pendingOfflineRewards && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                你離開了{" "}
                <span className="text-foreground font-medium">
                  {pendingOfflineRewards.minutes_away >= 60
                    ? `${Math.floor(pendingOfflineRewards.minutes_away / 60)} 小時 ${pendingOfflineRewards.minutes_away % 60} 分鐘`
                    : `${pendingOfflineRewards.minutes_away} 分鐘`}
                </span>
                ，{pendingOfflineRewards.activity}持續運行，共{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {pendingOfflineRewards.total_actions.toLocaleString()}
                </span>{" "}
                次
              </p>

              {Object.keys(pendingOfflineRewards.drops).length > 0 && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    獲得物品
                  </h3>
                  {Object.entries(pendingOfflineRewards.drops).map(([itemType, qty]) => {
                    const info = ITEM_INFO[itemType];
                    return (
                    <div key={itemType} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={info?.color ?? ""}>{info?.icon ?? "○"}</span>
                        <span>{info?.name ?? itemType}</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">x{qty.toLocaleString()}</span>
                    </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  經驗獲得
                </h3>
                <div className="flex justify-between text-sm">
                  <span>⛏ 挖礦</span>
                  <span className="tabular-nums">+{pendingOfflineRewards.xp_gained.mining.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>🏆 精通</span>
                  <span className="tabular-nums">+{pendingOfflineRewards.xp_gained.mastery.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>💪 練體</span>
                  <span className="tabular-nums">+{pendingOfflineRewards.xp_gained.body.toLocaleString()}</span>
                </div>
              </div>

              <Button className="w-full seal-glow font-heading" onClick={dismissOfflineRewards}>
                領取完畢
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
