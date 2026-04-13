"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventoryItem } from "@/lib/types";
import { getItem } from "@/lib/items";
import { useI18n } from "@/lib/i18n";

interface SacrificeSelection {
  [itemType: string]: number; // item_type → quantity to sacrifice
}

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
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [inventory, setInventory] = useState(initialInventory);
  const [daoPoints, setDaoPoints] = useState(initialDaoPoints);
  const [sacrificeMode, setSacrificeMode] = useState(false);
  const [selections, setSelections] = useState<SacrificeSelection>({});
  const [sacrificing, setSacrificing] = useState(false);

  const slotsUsed = new Set(inventory.map((i) => i.item_type)).size;

  const totalSelected = Object.values(selections).reduce((sum, q) => sum + q, 0);
  const totalDaoGained = totalSelected; // 1:1 ratio

  const toggleItem = (item: InventoryItem) => {
    setSelections((prev) => {
      if (prev[item.item_type]) {
        // Already selected → remove
        const next = { ...prev };
        delete next[item.item_type];
        return next;
      }
      // Select with full quantity by default
      return { ...prev, [item.item_type]: item.quantity };
    });
  };

  const updateQuantity = (itemType: string, qty: number) => {
    setSelections((prev) => ({ ...prev, [itemType]: qty }));
  };

  const handleConfirmSacrifice = async () => {
    if (totalSelected === 0) return;
    setSacrificing(true);

    try {
      // Sacrifice each item type sequentially
      let latestDaoPoints = daoPoints;
      for (const [itemType, qty] of Object.entries(selections)) {
        if (qty <= 0) continue;
        const res = await fetch("/api/game/sacrifice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_type: itemType, quantity: qty }),
        });
        if (res.ok) {
          const data = await res.json();
          latestDaoPoints = data.dao_points_total;
        }
      }

      setDaoPoints(latestDaoPoints);
      setInventory((prev) =>
        prev
          .map((i) => selections[i.item_type] ? { ...i, quantity: i.quantity - selections[i.item_type] } : i)
          .filter((i) => i.quantity > 0)
      );
      setSelections({});
      setSacrificeMode(false);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setSacrificing(false);
    }
  };

  const exitSacrificeMode = () => {
    setSacrificeMode(false);
    setSelections({});
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                儲物袋
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                管理你的物資與資源
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
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg">物品</CardTitle>
              {inventory.length > 0 && !sacrificeMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSacrificeMode(true)}
                  className="font-heading border-cinnabar/30 text-cinnabar hover:bg-cinnabar-dim hover:text-cinnabar"
                >
                  獻祭
                </Button>
              )}
              {sacrificeMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSacrificeMode}
                  className="text-muted-foreground"
                >
                  取消
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sacrificeMode && (
              <p className="mb-4 text-sm text-cinnabar/80">
                點選要獻祭的物品，再按下方確認
              </p>
            )}

            {inventory.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  <TooltipProvider>
                    {inventory.map((item) => {
                      const display = getItem(item.item_type);
                      const isSelected = !!selections[item.item_type];
                      const selectedQty = selections[item.item_type] ?? 0;

                      return (
                        <Tooltip key={item.item_type}>
                          <TooltipTrigger
                            onClick={sacrificeMode ? () => toggleItem(item) : undefined}
                            className={`flex w-full flex-col items-center gap-1 rounded-lg border p-3 transition-all ${
                              sacrificeMode
                                ? isSelected
                                  ? "border-cinnabar bg-cinnabar-dim/40 scale-105 shadow-md"
                                  : "border-border/50 bg-card/60 hover:border-cinnabar/40 hover:bg-card cursor-pointer"
                                : "border-border/50 bg-card/60"
                            }`}
                          >
                              <span className={`text-2xl ${display?.color ?? "text-foreground"}`}>
                                {display?.icon ?? "○"}
                              </span>
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {isSelected ? `${selectedQty}/${item.quantity}` : `x${item.quantity.toLocaleString()}`}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] text-cinnabar font-heading">已選</span>
                              )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-heading">{display ? (isZh ? display.nameZh : display.nameEn) : item.item_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity.toLocaleString()} {isZh ? "個" : ""}
                              {sacrificeMode && !isSelected && " · 點擊選取"}
                              {sacrificeMode && isSelected && " · 點擊取消"}
                            </p>
                            {display?.hintZh && (
                              <p className="text-xs text-jade mt-1">{isZh ? display.hintZh : display.hintEn}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>

                  {!sacrificeMode && Array.from({ length: Math.min(totalSlots - slotsUsed, 12) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex h-[72px] items-center justify-center rounded-lg border border-dashed border-border/30"
                    >
                      <span className="text-xs text-muted-foreground/20">+</span>
                    </div>
                  ))}
                </div>

                {/* Selected items detail + quantity adjustment */}
                {sacrificeMode && totalSelected > 0 && (
                  <div className="mt-6 space-y-3">
                    <Separator />
                    <h3 className="text-sm font-medium text-muted-foreground">獻祭清單</h3>
                    {Object.entries(selections).map(([itemType, qty]) => {
                      const item = inventory.find((i) => i.item_type === itemType);
                      if (!item) return null;
                      const display = getItem(itemType);
                      return (
                        <div key={itemType} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={display?.color ?? ""}>{display?.icon ?? "○"}</span>
                            <span className="text-sm font-medium">{display ? (isZh ? display.nameZh : display.nameEn) : itemType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-6 w-6 text-xs"
                              disabled={qty <= 1}
                              onClick={() => updateQuantity(itemType, qty - 1)}
                            >-</Button>
                            <span className="text-sm tabular-nums w-10 text-center">{qty}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6 text-xs"
                              disabled={qty >= item.quantity}
                              onClick={() => updateQuantity(itemType, qty + 1)}
                            >+</Button>
                            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-1.5"
                              onClick={() => updateQuantity(itemType, item.quantity)}
                            >全部</Button>
                          </div>
                        </div>
                      );
                    })}

                    <Separator />

                    <div className="rounded-lg bg-cinnabar-dim/30 border border-cinnabar/15 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">獲得天道值</span>
                        <span className="font-heading font-bold text-cinnabar tabular-nums">+{totalDaoGained.toLocaleString()}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full seal-glow font-heading"
                      onClick={handleConfirmSacrifice}
                      disabled={sacrificing}
                    >
                      {sacrificing ? "獻祭中..." : `確認獻祭（共 ${totalSelected} 個物品）`}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/20 border border-border/30">
                  <span className="text-3xl text-muted-foreground/40">🎒</span>
                </div>
                <p className="font-heading text-lg font-medium text-muted-foreground">
                  儲物袋空空如也
                </p>
                <p className="mt-2 text-sm text-muted-foreground/70">
                  前往礦場開始採集資源
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
