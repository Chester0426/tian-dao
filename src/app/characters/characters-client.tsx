"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useSignMessage, useDisconnect } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SlotData } from "./page";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function CharactersClient({
  slots,
  stageNames,
  walletAddress: initialWalletAddress,
}: {
  slots: SlotData[];
  stageNames: Record<number, string>;
  walletAddress: string | null;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [bindingWallet, setBindingWallet] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [offlineRewards, setOfflineRewards] = useState<{
    minutes_away: number;
    total_actions: number;
    drops: { item_type: string; quantity: number }[];
    xp_gained: { mining: number; mastery: number; body: number };
    redirectTo: string;
  } | null>(null);

  const ITEM_NAMES: Record<string, string> = {
    coal: "煤", copper_ore: "銅礦", spirit_stone_fragment: "靈石碎片",
  };

  const handleSelectSlot = async (slot: number, hasProfile: boolean, lastActivity: string | null, lastMineSlug: string | null) => {
    setLoading(slot);
    try {
      if (!hasProfile) {
        await fetch("/api/game/init-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot }),
        });
      }

      await fetch("/api/game/select-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      });

      const redirectTo = hasProfile && lastActivity === "mining" && lastMineSlug
        ? `/mining/${lastMineSlug}`
        : "/dashboard";

      // Try to claim offline rewards before entering game
      if (hasProfile && lastActivity === "mining") {
        try {
          const res = await fetch("/api/game/offline-rewards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.total_actions > 0) {
              setOfflineRewards({ ...data, redirectTo });
              setLoading(null);
              return; // Show dialog instead of redirecting
            }
          }
        } catch {
          // ignore — enter game without rewards
        }
      }

      router.push(redirectTo);
    } catch {
      setLoading(null);
    }
  };

  const handleDismissRewards = () => {
    const redirectTo = offlineRewards?.redirectTo ?? "/dashboard";
    setOfflineRewards(null);
    router.push(redirectTo);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/game/delete-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: deleteTarget.slot }),
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen ink-wash-bg ink-noise flex items-center justify-center">
      <div className="w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            天道
          </h1>
          <p className="mt-2 text-muted-foreground">選擇存檔開始修煉</p>

          {/* Wallet binding */}
          <div className="mt-4">
            {walletAddress ? (
              <Badge variant="outline" className="border-jade/30 text-jade font-mono text-xs px-3 py-1.5">
                🔗 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Badge>
            ) : isConnected && address ? (
              <Button
                size="sm"
                variant="outline"
                disabled={bindingWallet}
                className="border-cinnabar/30 text-cinnabar hover:bg-cinnabar-dim"
                onClick={async () => {
                  setBindingWallet(true);
                  try {
                    const message = `天道 — 綁定錢包\n\n地址: ${address}\n時間: ${new Date().toISOString()}`;
                    const signature = await signMessageAsync({ message });
                    const res = await fetch("/api/game/bind-wallet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ address, signature, message }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setWalletAddress(data.wallet_address);
                    }
                  } catch {
                    // User rejected or error
                  } finally {
                    setBindingWallet(false);
                  }
                }}
              >
                {bindingWallet ? "簽名中..." : "簽名綁定此錢包"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-muted-foreground/30 text-muted-foreground"
                onClick={() => connect({ connector: connectors[0] })}
              >
                連接錢包
              </Button>
            )}
          </div>
        </div>

        {/* 3 Slot Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {slots.map((slotData) => {
            const { slot, profile, miningLevel, lastPlayed } = slotData;
            const isEmpty = !profile;
            const isLoading = loading === slot;

            return (
              <Card
                key={slot}
                className={`scroll-surface transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  isEmpty ? "border-dashed" : ""
                }`}
              >
                <CardContent className="flex flex-col items-center gap-4 py-8">
                  {/* Slot number */}
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground border-border/40"
                  >
                    存檔 {slot}
                  </Badge>

                  {isEmpty && slot > 1 ? (
                    <>
                      {/* Locked slot */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/10 border border-dashed border-border/20">
                        <span className="text-3xl text-muted-foreground/20">🔒</span>
                      </div>
                      <p className="text-sm text-muted-foreground/60">未解鎖</p>
                      <Button
                        disabled
                        variant="outline"
                        className="w-full opacity-50"
                      >
                        即將開放
                      </Button>
                    </>
                  ) : isEmpty ? (
                    <>
                      {/* Empty slot — free (slot 1 only) */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-dashed border-border/40">
                        <span className="text-3xl text-muted-foreground/30">+</span>
                      </div>
                      <p className="text-sm text-muted-foreground">空存檔</p>
                      <Button
                        onClick={() => handleSelectSlot(slot, false, null, null)}
                        disabled={isLoading}
                        className="w-full seal-glow font-heading"
                      >
                        {isLoading ? "建立中..." : "建立角色"}
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Occupied slot */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cinnabar-dim border border-cinnabar/20">
                        <span className="font-heading text-2xl font-bold text-cinnabar">
                          {profile.cultivation_stage}
                        </span>
                      </div>

                      <div className="text-center space-y-1">
                        <p className="font-heading font-bold text-sm">
                          {stageNames[profile.cultivation_stage] ?? `練體${profile.cultivation_stage}階`}
                        </p>
                        {miningLevel > 0 && (
                          <p className="text-xs text-muted-foreground">
                            采掘 Lv.{miningLevel}
                          </p>
                        )}
                        {lastPlayed && (
                          <p className="text-[10px] text-muted-foreground/60">
                            {formatTimeAgo(lastPlayed)}
                          </p>
                        )}
                      </div>

                      <div className="flex w-full gap-2">
                        <Button
                          onClick={() => handleSelectSlot(slot, true, slotData.lastActivity, slotData.lastMineSlug)}
                          disabled={isLoading}
                          className="flex-1 seal-glow font-heading"
                        >
                          {isLoading ? "載入中..." : "載入"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteTarget(slotData)}
                          className="text-muted-foreground hover:text-destructive hover:border-destructive/30"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
                          </svg>
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Offline rewards dialog */}
      <Dialog open={!!offlineRewards} onOpenChange={() => handleDismissRewards()}>
        <DialogContent className="scroll-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">離線收益</DialogTitle>
          </DialogHeader>
          {offlineRewards && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                你離開了{" "}
                <span className="text-foreground font-medium">
                  {offlineRewards.minutes_away >= 60
                    ? `${Math.floor(offlineRewards.minutes_away / 60)} 小時 ${offlineRewards.minutes_away % 60} 分鐘`
                    : `${offlineRewards.minutes_away} 分鐘`}
                </span>
                ，期間共采掘{" "}
                <span className="text-foreground font-medium tabular-nums">{offlineRewards.total_actions.toLocaleString()}</span> 次
              </p>

              {offlineRewards.drops.length > 0 && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">獲得物品</h3>
                  {offlineRewards.drops.map((drop) => (
                    <div key={drop.item_type} className="flex items-center justify-between text-sm">
                      <span>{ITEM_NAMES[drop.item_type] ?? drop.item_type}</span>
                      <span className="tabular-nums text-muted-foreground">x{drop.quantity.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">經驗獲得</h3>
                <div className="flex justify-between text-sm">
                  <span>采掘</span>
                  <span className="tabular-nums">+{offlineRewards.xp_gained.mining.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>精通</span>
                  <span className="tabular-nums">+{offlineRewards.xp_gained.mastery.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>練體</span>
                  <span className="tabular-nums">+{offlineRewards.xp_gained.body.toLocaleString()}</span>
                </div>
              </div>

              <Button className="w-full seal-glow font-heading" onClick={handleDismissRewards}>
                領取並進入遊戲
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
        <DialogContent className="scroll-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">刪除角色</DialogTitle>
          </DialogHeader>
          {deleteTarget?.profile && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                確定要刪除存檔 {deleteTarget.slot} 的角色嗎？
              </p>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
                <p className="font-heading font-bold text-destructive">
                  {stageNames[deleteTarget.profile.cultivation_stage] ?? `練體${deleteTarget.profile.cultivation_stage}階`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  此操作無法復原，所有進度將永久刪除。
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  請輸入 <span className="font-bold text-destructive">Delete</span> 確認刪除
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="輸入 Delete"
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/40"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== "Delete"}
                >
                  {deleting ? "刪除中..." : "確認刪除"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
