"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventoryItem } from "@/lib/types";

const ITEM_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  coal: { name: "煤", icon: "◆", color: "text-ink-2" },
  copper_ore: { name: "銅礦", icon: "◇", color: "text-spirit-gold" },
  spirit_stone_fragment: { name: "靈石碎片", icon: "✦", color: "text-jade" },
};

export function InventoryClient({ inventory, totalSlots }: { inventory: InventoryItem[]; totalSlots: number }) {
  const slotsUsed = new Set(inventory.map((i) => i.item_type)).size;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            背包
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理你的物資與資源
          </p>
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
                          <div className="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-card/60 p-3 transition-colors hover:border-jade/30 hover:bg-card">
                            <span className={`text-2xl ${display?.color ?? "text-foreground"}`}>
                              {display?.icon ?? "○"}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              x{item.quantity.toLocaleString()}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-heading">{display?.name ?? item.item_type}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity.toLocaleString()} 個</p>
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
    </div>
  );
}
