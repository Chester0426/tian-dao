"use client";

import { useGameState } from "@/components/mining-provider";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { ITEMS } from "@/lib/items";
import type { ActivitySwitchConfirm } from "@/components/mining-provider";

function ActivitySwitchDialog({ confirm, onDismiss, onSetDontAsk, isZh }: {
  confirm: ActivitySwitchConfirm | null;
  onDismiss: () => void;
  onSetDontAsk: (v: boolean) => void;
  isZh: boolean;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Dialog open={!!confirm} onOpenChange={() => onDismiss()}>
      <DialogContent className="scroll-surface sm:max-w-sm" showCloseButton={false}>
        {confirm && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="font-heading text-lg font-bold">
              {isZh ? "切換技能" : "Switch Activity"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isZh
                ? `切換到「${confirm.to}」將停止當前的「${confirm.from}」，確定嗎？`
                : `Switching to "${confirm.to}" will stop "${confirm.from}". Continue?`}
            </p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={dontAsk}
                onChange={(e) => setDontAsk(e.target.checked)}
                className="rounded border-border"
              />
              {isZh ? "不再顯示此提示" : "Don't show this again"}
            </label>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => onDismiss()}>
                {isZh ? "取消" : "Cancel"}
              </Button>
              <Button className="flex-1 seal-glow" onClick={() => {
                if (dontAsk) onSetDontAsk(true);
                confirm.onConfirm();
              }}>
                {isZh ? "確定切換" : "Switch"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



export function GlobalGameUI() {
  const gameState = useGameState();
  const { notifications, pendingOfflineRewards, dismissOfflineRewards, hasEntered, offlineLoading } = gameState;
  const pathname = usePathname();
  const { locale } = useI18n();
  const isZh = locale === "zh";
  // Network status indicator. Server-authoritative architecture means every
  // action writes to DB immediately — there is no "pending sync" concept to
  // visualize. Replace the legacy cloud-save indicator with online/offline.
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showSyncTooltip, setShowSyncTooltip] = useState(false);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const statusText = isOnline ? (isZh ? "已連線" : "Online") : (isZh ? "已斷線" : "Offline");

  return (
    <>
      {/* Network status indicator — green dot = online, red = offline */}
      {hasEntered && (
        <div
          className="fixed top-4 right-4 z-40"
          onMouseEnter={() => setShowSyncTooltip(true)}
          onMouseLeave={() => setShowSyncTooltip(false)}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
            style={{
              background: "rgba(30,20,10,0.6)",
              border: `1px solid ${isOnline ? "rgba(62,207,165,0.6)" : "rgba(255,100,100,0.6)"}`,
              boxShadow: isOnline ? "0 0 8px rgba(62,207,165,0.3)" : "0 0 8px rgba(255,100,100,0.3)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOnline ? "#3ecfa5" : "#ff6464"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isOnline ? (
                <>
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </>
              ) : (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                  <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </>
              )}
            </svg>
          </div>
          {showSyncTooltip && (
            <div className="absolute top-full right-0 mt-1 whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] text-foreground shadow-lg">
              {statusText}
            </div>
          )}
        </div>
      )}
      {/* === System 1: Global floating notifications === */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 z-50 flex flex-col items-center gap-1 pointer-events-none left-1/2 -translate-x-1/2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-lg bg-card/95 border border-border/50 px-3 py-1.5 text-sm backdrop-blur-sm shadow-lg"
              style={{ animation: "drop-float-up 2.5s ease-out forwards" }}
            >
              {n.image
                ? <img src={n.image} alt="" className="h-4 w-4 object-contain" />
                : <span className={`text-sm ${n.color}`}>{n.icon}</span>}
              {n.amount > 0 && <span className={`font-bold tabular-nums ${n.color}`}>+{n.amount}</span>}
              <span className={n.amount === 0 ? n.color : "text-muted-foreground"}>{n.label}</span>
              {n.total !== undefined && (
                <span className="text-xs tabular-nums text-muted-foreground/60">{n.total.toLocaleString()}{isZh ? "個" : ""}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === Offline loading indicator === */}
      {offlineLoading && hasEntered && !pendingOfflineRewards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl bg-card/95 border border-spirit-gold/30 px-6 py-4 shadow-xl">
            <div className="h-5 w-5 rounded-full border-2 border-spirit-gold/40 border-t-spirit-gold animate-spin" />
            <span className="text-spirit-gold font-heading text-base">{isZh ? "計算離線獎勵中..." : "Calculating rewards..."}</span>
          </div>
        </div>
      )}

      {/* === System 2: Melvor-style offline rewards dialog === */}
      <Dialog open={!!pendingOfflineRewards && hasEntered} onOpenChange={() => dismissOfflineRewards()}>
        <DialogContent className="scroll-surface sm:max-w-sm" showCloseButton={false}>
          {pendingOfflineRewards && (
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              {/* Activity icon */}
              <img
                src={
                  pendingOfflineRewards.activity === "挖礦" ? "/images/nav-items/nav-mining.png"
                  : pendingOfflineRewards.activity === "遊歷" ? "/images/nav-items/nav-adventure.png"
                  : pendingOfflineRewards.activity === "參悟" ? "/images/nav-items/nav-enlightenment.png"
                  : "/images/nav-items/nav-dashboard.png"
                }
                alt=""
                className="h-16 w-16 object-contain"
              />

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
                      {isZh ? " 個敵人" : " enemies"}
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
                  const info = ITEMS[itemType];
                  return (
                    <p key={itemType} className="text-base">
                      {isZh ? "你獲得了 " : "You gained "}
                      <span className={`font-bold tabular-nums ${info?.color ?? "text-foreground"}`}>
                        {(qty as number).toLocaleString()}
                      </span>
                      {isZh ? " 個 " : " "}
                      {info?.image
                        ? <img src={info.image} alt="" className="inline h-5 w-5 object-contain align-text-bottom" />
                        : <span className={info?.color ?? ""}>{info?.icon ?? "○"}</span>}
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
          {/* Consumable button — left, same style as retreat */}
          {(() => {
            const activeItem = gameState.consumableSlots[gameState.activeConsumableIdx];
            const meta = activeItem ? ITEMS[activeItem] : null;
            const invCount = activeItem ? (gameState.inventory.find((i) => i.item_type === activeItem)?.quantity ?? 0) : 0;
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <button
                      type="button"
                      onClick={meta ? gameState.consumeItem : undefined}
                      disabled={!meta}
                      className="relative rounded-lg border border-cinnabar/30 bg-card/95 backdrop-blur-sm shadow-xl p-2.5 text-muted-foreground/70 hover:text-jade hover:border-jade/60 hover:shadow-2xl hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-100 transition-all duration-150 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100"
                    >
                      {meta && invCount > 0 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-card border border-border/50 rounded-full px-1.5 text-[11px] tabular-nums text-muted-foreground leading-tight">{invCount}</span>
                      )}
                      {meta?.image
                        ? <img src={meta.image} alt="" className="w-6 h-6 object-contain drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]" />
                        : <span className="text-xl">{meta ? meta.icon : "🍽️"}</span>
                      }
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {meta ? (
                      <div>
                        <p className="font-heading text-sm">{isZh ? meta.nameZh : meta.nameEn}</p>
                        <p className="text-xs text-jade">{isZh ? `恢復 ${meta.healHp} 點氣血` : `Restore ${meta.healHp} HP`}</p>
                      </div>
                    ) : (
                      <p className="text-xs">{isZh ? "未裝備補品" : "No food equipped"}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()}
          {/* Combat HP panel — middle */}
          <div className="w-[240px] rounded-lg border border-cinnabar/30 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="h-0.5 bg-cinnabar" />
            <div className="px-4 py-3 space-y-2">
              {/* Player HP — green */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isZh ? "你" : "You"}</span>
                  <span className="text-jade tabular-nums">{gameState.playerHp}/{gameState.playerMaxHp}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full bg-jade transition-all duration-200" style={{ width: `${Math.max(0, (gameState.playerHp / gameState.playerMaxHp) * 100)}%` }} />
                </div>
              </div>
              {/* Monster HP — red */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isZh ? "敵人" : "Enemy"}</span>
                  <span className="text-red-400 tabular-nums">{gameState.monsterHp}/{gameState.combatMonster.hp}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full bg-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (gameState.monsterHp / gameState.combatMonster.hp) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
          {/* Retreat button — right (unchanged position) */}
          <button
            type="button"
            onClick={gameState.stopCombat}
            className="rounded-lg border border-cinnabar/30 bg-card/95 backdrop-blur-sm shadow-xl p-2.5 text-muted-foreground/70 hover:text-cinnabar hover:border-cinnabar/60 hover:shadow-2xl hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-100 transition-all duration-150"
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

      {/* === Activity switch confirmation dialog === */}
      <ActivitySwitchDialog
        confirm={gameState.activitySwitchConfirm}
        onDismiss={gameState.dismissActivitySwitch}
        onSetDontAsk={gameState.setDontAskActivitySwitch}
        isZh={isZh}
      />
    </>
  );
}
