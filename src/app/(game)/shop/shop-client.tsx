"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

function slotPrice(currentSlots: number): number {
  const extraSlots = currentSlots - 20;
  if (extraSlots <= 0) return 5;
  return 5 * Math.pow(2, extraSlots);
}

export function ShopClient({ spiritStones: initialStones, currentSlots: initialSlots }: { spiritStones: number; currentSlots: number }) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh";
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
            <img src="/images/nav-items/nav-shop.png" alt="" className="h-12 w-12 object-contain" />
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {isZh ? "商店" : "Shop"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? "使用天道碎片（TTAO）購買升級" : "Use TTAO fragments to purchase upgrades"}
          </p>
          <Separator className="mt-4" />
        </header>

        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{isZh ? "持有天道碎片:" : "TTAO Fragments:"}</span>
          <Badge variant="outline" className="border-jade/40 bg-jade text-white font-heading text-base px-3 py-1">
            🪙 {spiritStones.toLocaleString()}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="scroll-surface">
            <CardHeader>
              <CardTitle className="font-heading text-lg">{isZh ? "儲物袋擴充" : "Inventory Expansion"}</CardTitle>
              <CardDescription>{isZh ? "增加 1 格儲物袋空間" : "Add 1 inventory slot"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{isZh ? "當前格數" : "Current Slots"}</span>
                  <span className="tabular-nums font-medium">{currentSlots}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{isZh ? "擴充後" : "After"}</span>
                  <span className="tabular-nums font-medium text-jade">{currentSlots + 1}</span>
                </div>
                <Separator className="opacity-30" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{isZh ? "價格" : "Price"}</span>
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
                  ? (isZh ? "購買中..." : "Buying...")
                  : spiritStones < nextSlotPrice
                    ? (isZh ? `需要 ${nextSlotPrice - spiritStones} 天道碎片` : `Need ${nextSlotPrice - spiritStones} more`)
                    : (isZh ? `購買 (🪙 ${nextSlotPrice})` : `Buy (🪙 ${nextSlotPrice})`)}
              </Button>
            </CardContent>
          </Card>

          <Card className="scroll-surface border-dashed">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-muted-foreground">{isZh ? "更多商品" : "More Items"}</CardTitle>
              <CardDescription>{isZh ? "即將推出..." : "Coming soon..."}</CardDescription>
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
