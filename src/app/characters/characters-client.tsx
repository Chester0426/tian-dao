"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useI18n } from "@/lib/i18n";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
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
  const { locale, setLocale, t } = useI18n();
  const { publicKey, connected, signMessage } = useWallet();
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [bindingWallet, setBindingWallet] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Offline rewards handled by GlobalGameUI in game layout

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

      // Redirect to game — offline rewards handled by GlobalGameUI in game layout
      const redirectTo = hasProfile && lastActivity === "mining"
        ? "/mining"
        : "/dashboard";

      router.push(redirectTo);
    } catch {
      setLoading(null);
    }
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

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = "x-slot=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')" }} />
      <div className="absolute inset-0 bg-black/30" />

      {/* Language toggle */}
      <button
        type="button"
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        className="absolute right-5 top-5 z-20 rounded-full border border-white/20 bg-black/30 px-5 py-2 text-sm font-medium text-white/70 backdrop-blur-sm transition-colors hover:text-white hover:border-white/40"
      >
        {locale === "zh" ? "English" : "中文"}
      </button>

      <div className="relative z-10 w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <a href="/">
            <img src="/images/logo-dao.png" alt="天道" className="mx-auto h-24 w-24 mb-4 rounded-xl cursor-pointer transition-transform hover:scale-105" />
          </a>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            天道
          </h1>
          <p className="mt-2 text-muted-foreground">{t("char_subtitle")}</p>

          {/* Wallet binding */}
          <div className="mt-4">
            {walletAddress ? (
              <Badge variant="outline" className="border-jade/30 text-jade font-mono text-xs px-3 py-1.5">
                🔗 {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </Badge>
            ) : connected && publicKey && signMessage ? (
              <Button
                size="sm"
                variant="outline"
                disabled={bindingWallet}
                className="border-cinnabar/30 text-cinnabar hover:bg-cinnabar-dim"
                onClick={async () => {
                  setBindingWallet(true);
                  try {
                    const addr = publicKey.toBase58();
                    const message = `天道 — 綁定錢包\n\n地址: ${addr}\n時間: ${new Date().toISOString()}`;
                    const encodedMessage = new TextEncoder().encode(message);
                    const signatureBytes = await signMessage(encodedMessage);
                    const signature = bs58.encode(signatureBytes);
                    const res = await fetch("/api/game/bind-wallet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ address: addr, signature, message }),
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
                {bindingWallet ? t("char_signing") : t("char_signBind")}
              </Button>
            ) : (
              <WalletMultiButton style={{ height: "32px", fontSize: "14px" }} />
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("sidebar_logout")}
          </button>
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
                    {t("char_save")} {slot}
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
                        {t("char_lockedBtn")}
                      </Button>
                    </>
                  ) : isEmpty ? (
                    <>
                      {/* Empty slot — free (slot 1 only) */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-dashed border-border/40">
                        <span className="text-3xl text-muted-foreground/30">+</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{t("char_empty")}</p>
                      <Button
                        onClick={() => handleSelectSlot(slot, false, null, null)}
                        disabled={isLoading}
                        className="w-full seal-glow font-heading"
                      >
                        {isLoading ? t("char_creating") : t("char_create")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Occupied slot */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cinnabar-dim border border-cinnabar/20">
                        <span className="font-heading text-2xl font-bold text-cinnabar">
                          {profile.realm_level ?? profile.cultivation_stage}
                        </span>
                      </div>

                      <div className="text-center space-y-1">
                        <p className="font-heading font-bold text-sm">
                          {locale === "zh"
                            ? `${(profile.realm ?? "煉體")}期 ${profile.realm_level >= 9 ? "巔峰" : (profile.realm_level ?? profile.cultivation_stage) + " 級"}`
                            : `Body Refining ${profile.realm_level >= 9 ? "Peak" : "Lv." + (profile.realm_level ?? profile.cultivation_stage)}`
                          }
                        </p>
                        {miningLevel > 0 && (
                          <p className="text-xs text-muted-foreground">
                            挖礦 Lv.{miningLevel}
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
                          {isLoading ? t("char_loading") : t("char_load")}
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

      {/* Offline rewards handled by GlobalGameUI in game layout */}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
        <DialogContent className="scroll-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">{t("char_delete")}</DialogTitle>
          </DialogHeader>
          {deleteTarget?.profile && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {t("char_deleteConfirm", { n: deleteTarget.slot })}
              </p>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
                <p className="font-heading font-bold text-destructive">
                  {locale === "zh"
                    ? `${(deleteTarget.profile.realm ?? "煉體")}期 ${deleteTarget.profile.realm_level >= 9 ? "巔峰" : (deleteTarget.profile.realm_level ?? deleteTarget.profile.cultivation_stage) + " 級"}`
                    : `Body Refining ${deleteTarget.profile.realm_level >= 9 ? "Peak" : "Lv." + (deleteTarget.profile.realm_level ?? deleteTarget.profile.cultivation_stage)}`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("char_deleteWarn")}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("char_deleteInput")} <span className="font-bold text-destructive">Delete</span> {t("char_deleteInputHint")}
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
                  {deleting ? t("char_deleting") : t("char_confirmDelete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
