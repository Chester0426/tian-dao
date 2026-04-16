"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  console.log("inventory", inventory)
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
        {/* === Header Bar === */}
        <div className="mb-6 relative rounded-2xl overflow-hidden -mx-6 md:-mx-12">
          <img src="/images/inventory-title-bg.png" alt="" className="w-full h-auto block" />
          <div
            className="absolute inset-0 px-6 flex items-center justify-between"
            style={{
              textShadow: "0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(62,207,165,0.2) 0%, rgba(26,74,58,0.3) 100%)",
                  boxShadow: "0 0 10px rgba(62,207,165,0.2), inset 0 0 6px rgba(0,0,0,0.3)",
                  border: "1px solid rgba(62,207,165,0.3)",
                }}
              >
                <span className="text-xl">🎒</span>
              </div>
              <div>
                <h1
                  className="font-heading text-xl font-bold sm:text-2xl"
                  style={{
                    background: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
                  }}
                >
                  {isZh ? "儲物袋" : "Inventory"}
                </h1>
                <p className="text-xs text-white/50">
                  {isZh ? "管理你的物資與資源" : "Manage your supplies and resources"}
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-heading"
              style={{
                background: "linear-gradient(135deg, rgba(200,60,60,0.15), rgba(120,30,30,0.25))",
                border: "1px solid rgba(200,60,60,0.3)",
                boxShadow: "0 0 6px rgba(200,60,60,0.1)",
                color: "#f87171",
              }}
            >
              天道值 {daoPoints.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Slot usage bar */}
        <div className="mb-6 -mx-6 md:-mx-12">
          <div
            className="relative h-7 w-full overflow-hidden rounded-full"
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.5), rgba(20,20,20,0.4))",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {(() => {
              const pct = totalSlots > 0 ? (slotsUsed / totalSlots) * 100 : 0;
              return (
                <>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      background: pct >= 90
                        ? "linear-gradient(90deg, #7f1d1d, #dc2626, #f87171)"
                        : "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
                      boxShadow: pct >= 90
                        ? "0 0 8px rgba(248,113,113,0.5), 0 0 20px rgba(248,113,113,0.15)"
                        : "0 0 8px rgba(62,207,165,0.5), 0 0 20px rgba(62,207,165,0.15)",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)",
                      }}
                    />
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center gap-2 text-sm tabular-nums"
                    style={{
                      textShadow: "0 0 1px #000, 0 0 4px #000, 0 1px 6px rgba(0,0,0,0.9)",
                      color: "#fff",
                    }}
                  >
                    <span
                      className="font-heading font-bold"
                      style={{
                        color: pct >= 90 ? "#f87171" : "#fbbf24",
                        textShadow: `0 0 1px #000, 0 0 4px #000, 0 0 10px ${pct >= 90 ? "rgba(248,113,113,0.4)" : "rgba(212,166,67,0.4)"}, 0 1px 6px rgba(0,0,0,0.9)`,
                      }}
                    >
                      {isZh ? "格數" : "Slots"}
                    </span>
                    <span className="font-bold">
                      {slotsUsed} / {totalSlots}
                    </span>
                    <span className="font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>({pct.toFixed(1)}%)</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <Card className="scroll-surface -mx-6 md:-mx-12">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">物品 <span className="text-sm text-muted-foreground tabular-nums font-normal">{slotsUsed}/{totalSlots}</span></CardTitle>
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
                            className={`flex w-full flex-col items-center gap-1 rounded-lg border transition-all ${
                              display?.tags.includes("equipment") ? "p-1.5" : "p-3"
                            } ${
                              sacrificeMode
                                ? isSelected
                                  ? "border-cinnabar bg-cinnabar-dim/40 scale-105 shadow-md"
                                  : "border-border/50 bg-card/60 hover:border-cinnabar/40 hover:bg-card cursor-pointer"
                                : "border-border/50 bg-card/60"
                            }`}
                          >
                              {(display as unknown as Record<string, unknown>)?.image ? (
                                <img src={(display as unknown as Record<string, string>).image} alt="" className={`${display!.tags.includes("equipment") ? "w-12 h-12" : "w-8 h-8"} object-contain`} />
                              ) : (
                                <span className={`text-2xl ${display?.color ?? "text-foreground"}`}>
                                  {display?.icon ?? "○"}
                                </span>
                              )}
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {isSelected ? `${selectedQty}/${item.quantity}` : `x${item.quantity.toLocaleString()}`}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] text-cinnabar font-heading">已選</span>
                              )}
                          </TooltipTrigger>
                          <TooltipContent className="block">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-heading text-sm">{display ? (isZh ? display.nameZh : display.nameEn) : item.item_type}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">×{item.quantity.toLocaleString()}</span>
                            </div>
                            {display?.hintZh && (
                              <p className="text-[11px] text-jade">{isZh ? display.hintZh : display.hintEn}</p>
                            )}
                            {sacrificeMode && (
                              <p className="text-[11px] text-muted-foreground">{isSelected ? (isZh ? "點擊取消" : "Click to deselect") : (isZh ? "點擊選取" : "Click to select")}</p>
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
                            {(display as unknown as Record<string, unknown>)?.image ? (
                              <img src={(display as unknown as Record<string, string>).image} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <span className={display?.color ?? ""}>{display?.icon ?? "○"}</span>
                            )}
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
