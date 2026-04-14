"use client";

import { useGameState } from "@/components/mining-provider";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

const ITEM_INFO: Record<string, { nameZh: string; nameEn: string; icon: string; color: string }> = {
  coal: { nameZh: "煤", nameEn: "Coal", icon: "◆", color: "text-foreground" },
  copper_ore: { nameZh: "銅礦", nameEn: "Copper Ore", icon: "◇", color: "text-jade" },
  spirit_stone_fragment: { nameZh: "靈石碎片", nameEn: "Spirit Stone Fragment", icon: "✦", color: "text-spirit-gold" },

};

export function GlobalGameUI() {
  const gameState = useGameState();
  const { notifications, pendingOfflineRewards, dismissOfflineRewards } = gameState;
  const pathname = usePathname();
  const { locale } = useI18n();
  const isZh = locale === "zh";

  return (
    <>
      {/* === System 1: Global floating notifications === */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 -translate-x-1/2 left-1/2 md:left-[calc((100vw+14rem)/2)] lg:left-[calc((100vw+15rem)/2)] z-50 flex flex-col items-center gap-1 pointer-events-none">
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
                <span className="text-xs tabular-nums text-muted-foreground/60">{n.total.toLocaleString()}{isZh ? "個" : ""}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === System 2: Melvor-style offline rewards dialog === */}
      <Dialog open={!!pendingOfflineRewards} onOpenChange={() => dismissOfflineRewards()}>
        <DialogContent className="scroll-surface sm:max-w-sm" showCloseButton={false}>
          {pendingOfflineRewards && (
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              {/* Icon */}
              <img src="/images/logo-dao.png" alt="" className="h-16 w-16 rounded-xl" />

              {/* Welcome back */}
              <h2 className="font-heading text-2xl font-bold">
                {isZh ? "歡迎回來！" : "Welcome back!"}
              </h2>

              {/* Time away */}
              <div className="space-y-1">
                <p className="text-base text-foreground">
                  {isZh ? "你離開了大約 " : "You were away for about "}
                  <span className="font-bold">
                    {pendingOfflineRewards.minutes_away >= 60
                      ? isZh
                        ? `${Math.floor(pendingOfflineRewards.minutes_away / 60)} 小時 ${pendingOfflineRewards.minutes_away % 60} 分鐘`
                        : `${Math.floor(pendingOfflineRewards.minutes_away / 60)}h ${pendingOfflineRewards.minutes_away % 60}m`
                      : isZh
                      ? `${pendingOfflineRewards.minutes_away} 分鐘`
                      : `${pendingOfflineRewards.minutes_away}m`}
                  </span>
                </p>
                <p className="text-sm text-jade">
                  {isZh ? "(12 小時為離線進度的最大上限)" : "(12 hours is the maximum offline progress)"}
                </p>
              </div>

              {/* Rewards section */}
              <div className="space-y-3 w-full">
                <p className="text-sm text-muted-foreground">{isZh ? "在你離開時：" : "While you were away:"}</p>

                {/* Mining XP */}
                {pendingOfflineRewards.xp_gained.mining > 0 && (
                  <p className="text-base">
                    {isZh ? "你獲得了 " : "You gained "}
                    <span className="font-bold text-blue-400 tabular-nums">
                      {pendingOfflineRewards.xp_gained.mining.toLocaleString()}
                    </span>
                    {isZh ? " 點挖礦技能經驗值" : " Mining XP"}
                  </p>
                )}

                {/* Body XP */}
                {pendingOfflineRewards.xp_gained.body > 0 && (
                  <p className="text-base">
                    {isZh ? "你獲得了 " : "You gained "}
                    <span className="font-bold text-spirit-gold tabular-nums">
                      {pendingOfflineRewards.xp_gained.body.toLocaleString()}
                    </span>
                    {isZh ? " 點煉體經驗值" : " Body Refining XP"}
                  </p>
                )}

                {/* Qi XP (meditation) */}
                {(pendingOfflineRewards.xp_gained as { qi?: number }).qi !== undefined && (pendingOfflineRewards.xp_gained as { qi?: number }).qi! > 0 && (
                  <p className="text-base">
                    {isZh ? "你獲得了 " : "You gained "}
                    <span className="font-bold text-jade tabular-nums">
                      {(pendingOfflineRewards.xp_gained as { qi?: number }).qi!.toLocaleString()}
                    </span>
                    {isZh ? " 點靈氣" : " Qi Condensation XP"}
                  </p>
                )}

                {/* Combat info */}
                {pendingOfflineRewards.combat && (
                  <>
                    <p className="text-base">
                      {isZh ? "你擊殺了 " : "You killed "}
                      <span className="font-bold text-cinnabar tabular-nums">
                        {pendingOfflineRewards.combat.kills}
                      </span>
                      {isZh ? " 隻怪物" : " monsters"}
                    </p>
                    {pendingOfflineRewards.combat.died && (
                      <p className="text-sm text-cinnabar">
                        {isZh ? "你在戰鬥中被擊敗了" : "You were defeated in combat"}
                      </p>
                    )}
                  </>
                )}

                {/* Items */}
                {Object.entries(pendingOfflineRewards.drops).map(([itemType, qty]) => {
                  const info = ITEM_INFO[itemType];
                  return (
                    <p key={itemType} className="text-base">
                      {isZh ? "你獲得了 " : "You gained "}
                      <span className={`font-bold tabular-nums ${info?.color ?? "text-foreground"}`}>
                        {(qty as number).toLocaleString()}
                      </span>
                      {isZh ? " 個 " : " "}
                      <span className={info?.color ?? ""}>{info?.icon ?? "○"}</span>
                      {" "}
                      <span className="font-medium">{info ? (isZh ? info.nameZh : info.nameEn) : itemType}</span>
                    </p>
                  );
                })}
              </div>

              {/* Claim button */}
              <Button
                className="w-full max-w-[200px] seal-glow font-heading text-base py-5"
                onClick={dismissOfflineRewards}
              >
                {isZh ? "好的" : "OK"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === Mini combat panel — fixed bottom-right, visible on all pages when fighting === */}
      {gameState.isCombating && gameState.combatMonster && pathname !== "/adventure" && (
        <div className="fixed bottom-4 right-4 md:right-6 z-40 flex items-end gap-2">
          {/* Combat HP panel */}
          <div className="w-[240px] rounded-lg border border-cinnabar/30 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="h-0.5 bg-cinnabar" />
            <div className="px-4 py-3 space-y-2">
              {/* Player HP */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isZh ? "你" : "You"}</span>
                  <span className="text-red-400 tabular-nums">{gameState.playerHp}/{gameState.playerMaxHp}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full bg-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (gameState.playerHp / gameState.playerMaxHp) * 100)}%` }} />
                </div>
              </div>
              {/* Monster HP */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isZh ? "敵人" : "Enemy"}</span>
                  <span className="text-cinnabar tabular-nums">{gameState.monsterHp}/{gameState.combatMonster.hp}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full bg-cinnabar transition-all duration-200" style={{ width: `${Math.max(0, (gameState.monsterHp / gameState.combatMonster.hp) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
          {/* Retreat button — separate */}
          <button
            type="button"
            onClick={gameState.stopCombat}
            className="rounded-lg border border-cinnabar/30 bg-card/95 backdrop-blur-sm shadow-xl p-2.5 text-muted-foreground/70 hover:text-cinnabar hover:border-cinnabar/60 transition-colors"
            title={isZh ? "撤退" : "Retreat"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
