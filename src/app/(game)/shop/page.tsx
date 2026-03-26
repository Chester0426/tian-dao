"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BASE_SLOT_PRICE = 5;
const INITIAL_SLOTS = 20;

export default function ShopPage() {
  const [spiritStones] = useState(0);
  const [currentSlots] = useState(INITIAL_SLOTS);
  const extraSlots = currentSlots - INITIAL_SLOTS;
  const nextSlotPrice = BASE_SLOT_PRICE + extraSlots * 3;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            商店
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            使用靈石碎片購買升級
          </p>
        </header>

        {/* Balance */}
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">持有靈石碎片:</span>
          <Badge variant="outline" className="border-jade/30 text-jade font-heading text-base px-3 py-1">
            ✦ {spiritStones.toLocaleString()}
          </Badge>
        </div>

        {/* Shop items */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Slot expansion */}
          <Card className="scroll-surface">
            <CardHeader>
              <CardTitle className="font-heading text-lg">背包擴充</CardTitle>
              <CardDescription>增加 1 格背包空間</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">當前格數</span>
                  <span className="tabular-nums font-medium">{currentSlots}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">擴充後</span>
                  <span className="tabular-nums font-medium text-jade">{currentSlots + 1}</span>
                </div>
                <Separator className="opacity-30" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">價格</span>
                  <span className="font-heading font-bold text-spirit-gold">
                    ✦ {nextSlotPrice}
                  </span>
                </div>
              </div>

              <Button
                className="w-full seal-glow"
                disabled={spiritStones < nextSlotPrice}
              >
                {spiritStones < nextSlotPrice
                  ? `需要 ${nextSlotPrice - spiritStones} 靈石碎片`
                  : `購買 (✦ ${nextSlotPrice})`}
              </Button>
            </CardContent>
          </Card>

          {/* Future items placeholder */}
          <Card className="scroll-surface border-dashed opacity-50">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-muted-foreground">更多商品</CardTitle>
              <CardDescription>即將推出...</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-12">
              <span className="text-3xl text-muted-foreground/30">🔮</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
