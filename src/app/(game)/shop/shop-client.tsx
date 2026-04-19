"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function slotPrice(currentSlots: number): number {
  const extraSlots = currentSlots - 20;
  if (extraSlots <= 0) return 5;
  return 5 * Math.pow(2, extraSlots);
}

export function ShopClient({ spiritStones: initialStones, currentSlots: initialSlots }: { spiritStones: number; currentSlots: number }) {
  const router = useRouter();
  const [spiritStones, setSpiritStones] = useState(initialStones);
  const [currentSlots, setCurrentSlots] = useState(initialSlots);
  const [buying, setBuying] = useState(false);
  const nextSlotPrice = slotPrice(currentSlots);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const res = await fetch("/api/game/shop/buy-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSlots(data.new_slots);
        setSpiritStones(data.spirit_stone_remaining);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 animate-[ink-fade-in_0.6s_ease-out]">
          <div className="flex items-center gap-3">
            <img src="/images/nav-items/nav-shop.png" alt="商店" className="h-12 w-12 object-contain" />
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              商店
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            使用天道碎片（TTAO）購買升級
          </p>
          <Separator className="mt-4" />
        </header>

        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">持有天道碎片:</span>
          <Badge variant="outline" className="border-jade/30 text-jade font-heading text-base px-3 py-1">
            🪙 {spiritStones.toLocaleString()}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="scroll-surface">
            <CardHeader>
              <CardTitle className="font-heading text-lg">儲物袋擴充</CardTitle>
              <CardDescription>增加 1 格儲物袋空間</CardDescription>
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
                    🪙 {nextSlotPrice}
                  </span>
                </div>
              </div>

              <Button
                className="w-full seal-glow"
                disabled={spiritStones < nextSlotPrice || buying}
                onClick={handleBuy}
              >
                {buying
                  ? "購買中..."
                  : spiritStones < nextSlotPrice
                    ? `需要 ${nextSlotPrice - spiritStones} 天道碎片`
                    : `購買 (🪙 ${nextSlotPrice})`}
              </Button>
            </CardContent>
          </Card>

          <Card className="scroll-surface border-dashed">
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
