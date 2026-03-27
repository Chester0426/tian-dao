"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
}: {
  slots: SlotData[];
  stageNames: Record<number, string>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSelectSlot = async (slot: number, hasProfile: boolean, lastActivity: string | null) => {
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

      // Redirect based on last activity
      if (hasProfile && lastActivity === "mining") {
        router.push("/mining");
      } else {
        router.push("/dashboard");
      }
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

  return (
    <div className="min-h-screen ink-wash-bg ink-noise flex items-center justify-center">
      <div className="w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            天道
          </h1>
          <p className="mt-2 text-muted-foreground">選擇存檔開始修煉</p>
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

                  {isEmpty ? (
                    <>
                      {/* Empty slot */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-dashed border-border/40">
                        <span className="text-3xl text-muted-foreground/30">+</span>
                      </div>
                      <p className="text-sm text-muted-foreground">空存檔</p>
                      <Button
                        onClick={() => handleSelectSlot(slot, false, null)}
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
                          onClick={() => handleSelectSlot(slot, true, slotData.lastActivity)}
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
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
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteTarget(null)}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deleting}
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
