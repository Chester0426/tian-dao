"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventoryItem } from "@/lib/types";

const ITEM_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  coal: { name: "煤", icon: "◆", color: "text-ink-2" },
  copper_ore: { name: "銅礦", icon: "◇", color: "text-spirit-gold" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "✦", color: "text-jade" },
};

export function InventoryClient({
  inventory: initialInventory,
  totalSlots,
  daoPoints: initialDaoPoints,
}: {
  inventory: InventoryItem[];
  totalSlots: number;
  daoPoints: number;
}) {
  const router = useRouter();
  const [inventory, setInventory] = useState(initialInventory);
  const [daoPoints, setDaoPoints] = useState(initialDaoPoints);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [sacrificeQty, setSacrificeQty] = useState(1);
  const [sacrificing, setSacrificing] = useState(false);

  const slotsUsed = new Set(inventory.map((i) => i.item_type)).size;

  const handleSacrifice = async () => {
    if (!selectedItem) return;
    setSacrificing(true);
    try {
      const res = await fetch("/api/game/sacrifice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: selectedItem.item_type, quantity: sacrificeQty }),
      });
      if (res.ok) {
        const data = await res.json();
        setDaoPoints(data.dao_points_total);
        // Update local inventory
        setInventory((prev) => {
          const remaining = prev.map((i) =>
            i.item_type === selectedItem.item_type
              ? { ...i, quantity: i.quantity - sacrificeQty }
              : i
          ).filter((i) => i.quantity > 0);
          return remaining;
        });
        setSelectedItem(null);
        setSacrificeQty(1);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setSacrificing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                背包
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                選取物品進行獻祭，獲得天道值
              </p>
            </div>
            <Badge variant="outline" className="border-cinnabar/30 text-cinnabar font-heading text-sm px-3 py-1.5">
              天道值 {daoPoints.toLocaleString()}
            </Badge>
          </div>
        </header>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">格數</span>
              <span className="tabular-nums">{slotsUsed} / {totalSlots}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-jade transition-all duration-500"
                style={{ width: `${(slotsUsed / totalSlots) * 100}%` }}
              />
            </div>
          </div>
          <Badge variant="outline" className="border-spirit-gold/30 text-spirit-gold tabular-nums">
            {slotsUsed}/{totalSlots}
          </Badge>
        </div>

        <Card className="scroll-surface">
          <CardHeader>
            <CardTitle className="font-heading text-lg">物品</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length > 0 ? (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                <TooltipProvider>
                  {inventory.map((item) => {
                    const display = ITEM_DISPLAY[item.item_type];
                    return (
                      <Tooltip key={item.item_type}>
                        <TooltipTrigger>
                          <button
                            onClick={() => { setSelectedItem(item); setSacrificeQty(1); }}
                            className="flex w-full flex-col items-center gap-1 rounded-lg border border-border/50 bg-card/60 p-3 transition-all hover:border-cinnabar/40 hover:bg-card hover:scale-105"
                          >
                            <span className={`text-2xl ${display?.color ?? "text-foreground"}`}>
                              {display?.icon ?? "○"}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              x{item.quantity.toLocaleString()}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-heading">{display?.name ?? item.item_type}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity.toLocaleString()} 個 · 點擊獻祭</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>

                {Array.from({ length: Math.min(totalSlots - slotsUsed, 12) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex h-[72px] items-center justify-center rounded-lg border border-dashed border-border/30"
                  >
                    <span className="text-xs text-muted-foreground/20">+</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-border/30">
                  <span className="text-3xl text-muted-foreground/40">🎒</span>
                </div>
                <p className="font-heading text-lg font-medium text-muted-foreground">
                  背包空空如也
                </p>
                <p className="mt-2 text-sm text-muted-foreground/70">
                  前往礦場開始採集資源
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sacrifice dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="scroll-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">獻祭物品</DialogTitle>
          </DialogHeader>
          {selectedItem && (() => {
            const display = ITEM_DISPLAY[selectedItem.item_type];
            const maxQty = selectedItem.quantity;
            const pointsGained = sacrificeQty; // 1:1 ratio
            return (
              <div className="space-y-4 py-2">
                {/* Item info */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg border border-border/50 bg-card/60 text-2xl ${display?.color ?? ""}`}>
                    {display?.icon ?? "○"}
                  </div>
                  <div>
                    <p className="font-heading font-bold">{display?.name ?? selectedItem.item_type}</p>
                    <p className="text-xs text-muted-foreground">持有 {maxQty.toLocaleString()} 個</p>
                  </div>
                </div>

                <Separator />

                {/* Quantity selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">獻祭數量</span>
                    <span className="tabular-nums font-medium">{sacrificeQty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={sacrificeQty <= 1}
                      onClick={() => setSacrificeQty((q) => Math.max(1, q - 1))}
                    >
                      -
                    </Button>
                    <input
                      type="range"
                      min={1}
                      max={maxQty}
                      value={sacrificeQty}
                      onChange={(e) => setSacrificeQty(Number(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={sacrificeQty >= maxQty}
                      onClick={() => setSacrificeQty((q) => Math.min(maxQty, q + 1))}
                    >
                      +
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSacrificeQty(1)}>1</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSacrificeQty(Math.floor(maxQty / 2))}>半數</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setSacrificeQty(maxQty)}>全部</Button>
                  </div>
                </div>

                <Separator />

                {/* Result preview */}
                <div className="rounded-lg bg-cinnabar-dim/30 border border-cinnabar/15 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">獲得天道值</span>
                    <span className="font-heading font-bold text-cinnabar tabular-nums">+{pointsGained.toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  className="w-full seal-glow font-heading"
                  onClick={handleSacrifice}
                  disabled={sacrificing}
                >
                  {sacrificing ? "獻祭中..." : `獻祭 ${sacrificeQty} 個`}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
