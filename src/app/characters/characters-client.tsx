"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useI18n } from "@/lib/i18n";
import { MINE_NAMES } from "@/lib/types";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SlotData } from "./page";

function formatTimeAgo(dateStr: string, isZh: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return isZh ? "剛剛" : "just now";
  if (minutes < 60) return isZh ? `${minutes} 分鐘前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isZh ? `${hours} 小時前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isZh ? `${days} 天前` : `${days}d ago`;
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
  const { locale, t } = useI18n();
  const { publicKey, connected, signMessage } = useWallet();
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [bindingWallet, setBindingWallet] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [namingSlot, setNamingSlot] = useState<number | null>(null);
  const [characterName, setCharacterName] = useState("");
  const [nameError, setNameError] = useState("");
  // Offline rewards handled by GlobalGameUI in game layout

  // Tick every 30s so "time ago" labels update live on this page
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

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
      <LanguageToggle />

      <div className="relative z-10 w-full max-w-5xl px-4 py-8">
        {/* Header — Logo + Title on one line */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <a href="/">
              <img src="/images/logo-dao.png" alt="天道" className="h-16 w-16 rounded-xl cursor-pointer transition-transform hover:scale-105" />
            </a>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                {locale === "zh" ? "天道" : "Tian Tao"}
              </h1>
            </div>
          </div>

          {/* Wallet binding + Logout on one line */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {walletAddress ? (
              <Badge variant="outline" className="border-jade/40 bg-jade text-white font-mono text-xs px-3 py-1.5">
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
                {bindingWallet ? t("char_signing") : (locale === "zh" ? "綁定錢包" : "Bind Wallet")}
              </Button>
            ) : (
              <WalletMultiButton style={{ width: "180px", height: "36px", fontSize: "14px", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundImage: "url('/images/btn-bg6.png')", backgroundSize: "100% 100%", backgroundPosition: "center", backgroundRepeat: "no-repeat", border: "none", boxShadow: "none", transition: "none" }} />
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t("sidebar_logout")}
            </button>
          </div>
        </div>

        {/* 3 Slot Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {slots.map((slotData) => {
            const { slot, profile, miningLevel, lastPlayed, lastActivity, lastMineSlug } = slotData;
            const isEmpty = !profile;
            const isLoading = loading === slot;

            return (
              <div key={slot} className="flex w-full flex-col items-center gap-2">
                {/* Top bar: Load + Delete (existing char) or Slot label (empty) */}
                {!isEmpty ? (
                  <div className="flex items-center w-full gap-2">
                    <Button
                      onClick={() => handleSelectSlot(slot, true, slotData.lastActivity, slotData.lastMineSlug)}
                      disabled={isLoading}
                      className="flex-1 h-[36px] font-heading text-sm font-bold bg-transparent bg-cover bg-center bg-no-repeat border-0 shadow-none hover:scale-[1.02] transition-transform text-black"
                      style={{ backgroundImage: "url('/images/btn-bg3.png')", backgroundSize: "100% 100%" }}
                    >
                      {isLoading ? t("char_loading") : t("char_load")}
                    </Button>
                    <button
                      onClick={() => setDeleteTarget(slotData)}
                      className="h-[36px] w-[36px] rounded-md border border-destructive/40 bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 hover:border-destructive/60 hover:scale-105 transition-all"
                    >
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
                      </svg>
                    </button>
                  </div>
                ) : (
                   <Button
                        className="mt-auto w-full font-heading bg-cover bg-center border-0 shadow-none bg-transparent text-white"
                        style={{ backgroundImage: "url('/images/btn-bg2.png')" }}
                      >
                        {t("char_lockedBtn")}
                      </Button>
                )}

                <Card
                  className={`w-full aspect-[3/4] bg-transparent ring-0 shadow-none relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                    isEmpty ? "border-dashed" : ""
                  }`}
                >
                  {/* Card background image */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${
                        isEmpty && slot > 1
                          ? '"/images/card-bg2.png"'
                          : isEmpty
                            ? '"/images/card-bg1.png"'
                            : '"/images/card-bg3.png"'
                      })`,
                    }}
                  />
                  {/* Slot number overlay — centered on red gem at top */}
                  <div className="absolute z-20 left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ top: "7%", width: "50px", height: "30px" }}>
                    <span className="font-heading text-2xl" style={{ lineHeight: 1, fontWeight: 900, color: "#000", WebkitTextStroke: "1px #000" }}>
                      {["", "壹", "貳", "參"][slot]}
                    </span>
                  </div>

                  <CardContent className="relative z-10 flex h-full flex-col items-center justify-center gap-4 py-8">

                  {isEmpty && slot > 1 ? (
                    <>
                      {/* Locked slot */}
                      {/* <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/10 border border-dashed border-border/20">
                        <span className="text-3xl text-muted-foreground/20">🔒</span>
                      </div> */}
                      {/* Locked label hidden per new card design */}
                     
                    </>
                  ) : isEmpty ? (
                    <>
                      {/* Empty slot — free (slot 1 only) */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-dashed border-border/40">
                        <span className="text-3xl text-muted-foreground/30">+</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{t("char_empty")}</p>
                      <Button
                        onClick={() => { setNamingSlot(slot); setCharacterName(""); setNameError(""); }}
                        disabled={isLoading}
                        className="mt-auto w-full font-heading bg-transparent bg-cover bg-center border-0 shadow-none hover:scale-[1.02] transition-transform text-white"
                        style={{ backgroundImage: "url('/images/btn-bg1.png')" }}
                      >
                        {isLoading ? t("char_creating") : t("char_create")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Character info — inside card, below jade plate area */}
                      <div className="flex-1" />
                      <div
                        className="text-center space-y-0.5 w-full rounded-lg px-3 py-2"
                        style={{
                          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.7) 100%)",
                        }}
                      >
                        {(profile as unknown as { character_name?: string }).character_name && (
                          <p
                            className="font-bold text-lg tracking-[0.15em]"
                            style={{
                              fontFamily: "var(--font-heading), serif",
                              background: "linear-gradient(135deg, #fcd34d, #f59e0b, #d97706)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              filter: "drop-shadow(0 0 4px rgba(245,158,11,0.3))",
                            }}
                          >
                            {(profile as unknown as { character_name?: string }).character_name}
                          </p>
                        )}
                        <p className="font-heading text-[13px]" style={{ color: "#e8d5a3", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                          {locale === "zh"
                            ? `${(profile.realm ?? "煉體")}期 ${profile.realm_level >= (profile.realm === "練氣" ? 13 : 9) ? "巔峰" : (profile.realm_level ?? profile.cultivation_stage) + " 級"}`
                            : `${({"煉體":"Body Refining","練氣":"Qi Condensation","築基":"Foundation","金丹":"Golden Core","元嬰":"Nascent Soul"} as Record<string,string>)[profile.realm] ?? "Body Refining"} ${profile.realm_level >= (profile.realm === "練氣" ? 13 : 9) ? "Peak" : "Lv." + (profile.realm_level ?? profile.cultivation_stage)}`
                          }
                        </p>
                        <p className="text-xs" style={{ color: lastActivity ? "#6ee7b7" : "rgba(255,255,255,0.4)", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                          {lastActivity === "meditate" ? (locale === "zh" ? "🧘 冥想中" : "🧘 Meditating")
                            : lastActivity === "mining" ? (locale === "zh" ? "⛏️ 挖礦中" : "⛏️ Mining")
                            : lastActivity === "combat" ? (locale === "zh" ? "⚔️ 戰鬥中" : "⚔️ Fighting")
                            : (locale === "zh" ? "休息中" : "Resting")}
                          {lastPlayed && <span style={{ color: "rgba(255,255,255,0.3)" }}> · {formatTimeAgo(lastPlayed, locale === "zh")}</span>}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              </div>
            );
          })}
        </div>
      </div>

      {/* Offline rewards handled by GlobalGameUI in game layout */}

      {/* Naming dialog */}
      <Dialog open={namingSlot !== null} onOpenChange={() => setNamingSlot(null)}>
        <DialogContent className="scroll-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">{locale === "zh" ? "為角色取名" : "Name Your Character"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {locale === "zh" ? "支援中文、日文、英文，1-12 字元" : "Supports Chinese, Japanese, English. 1-12 characters."}
            </p>
            <input
              type="text"
              value={characterName}
              onChange={(e) => { setCharacterName(e.target.value); setNameError(""); }}
              placeholder={locale === "zh" ? "輸入角色名稱" : "Enter character name"}
              maxLength={12}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jade/30 focus:border-jade/40"
              autoComplete="off"
            />
            {nameError && <p className="text-xs text-cinnabar">{nameError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNamingSlot(null)}>
                {locale === "zh" ? "取消" : "Cancel"}
              </Button>
              <Button
                className="flex-1 seal-glow"
                disabled={!characterName.trim() || loading !== null}
                onClick={async () => {
                  if (!namingSlot) return;
                  setLoading(namingSlot);
                  try {
                    await fetch("/api/game/init-profile", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: namingSlot, name: characterName.trim() }),
                    });
                    await fetch("/api/game/select-slot", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slot: namingSlot }),
                    });
                    setNamingSlot(null);
                    router.push("/dashboard");
                  } catch {
                    setNameError(locale === "zh" ? "創建失敗，請重試" : "Failed, please retry");
                    setLoading(null);
                  }
                }}
              >
                {loading !== null ? (locale === "zh" ? "創建中..." : "Creating...") : (locale === "zh" ? "開始修行" : "Begin")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    ? `${(deleteTarget.profile.realm ?? "煉體")}期 ${deleteTarget.profile.realm_level >= (deleteTarget.profile.realm === "練氣" ? 13 : 9) ? "巔峰" : (deleteTarget.profile.realm_level ?? deleteTarget.profile.cultivation_stage) + " 級"}`
                    : `${({"煉體":"Body Refining","練氣":"Qi Condensation","築基":"Foundation","金丹":"Golden Core","元嬰":"Nascent Soul"} as Record<string,string>)[deleteTarget.profile.realm] ?? "Body Refining"} ${deleteTarget.profile.realm_level >= (deleteTarget.profile.realm === "練氣" ? 13 : 9) ? "Peak" : "Lv." + (deleteTarget.profile.realm_level ?? deleteTarget.profile.cultivation_stage)}`
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
