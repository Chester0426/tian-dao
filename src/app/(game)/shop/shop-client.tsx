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

          <Card className="scroll-surface border-spirit-gold/40">
            <CardHeader>
              <CardTitle className="font-heading text-xl text-spirit-gold text-glow-gold">
                {isZh ? "天道 — 完整版" : "TIAN TAO — Full Version"}
              </CardTitle>
              <CardDescription className="text-base font-heading text-spirit-gold/80">10 USDC {isZh ? "一次買斷" : "One-time Purchase"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg bg-muted/30 p-4 space-y-2.5">
                {[
                  isZh ? "練氣 6 級之後所有境界內容" : "All realm content beyond Qi Condensation Level 6",
                  isZh ? "技能等級上限解鎖至 Lv.500" : "Skill level cap unlocked to Lv.500",
                  isZh ? "採藥、煉丹、釣魚" : "Herbalism, Alchemy, Fishing",
                  isZh ? "秘境挑戰" : "Dungeon Challenges",
                  isZh ? "市集交易" : "Marketplace Trading",
                  isZh ? "煉器進階配方" : "Advanced Smithing Recipes",
                  isZh ? "後續所有版本更新" : "All future updates",
                ].map((item, i) => (
                  <p key={i} className="text-sm flex items-start gap-2">
                    <span className="text-spirit-gold shrink-0">✦</span>
                    <span>{item}</span>
                  </p>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {isZh ? "元嬰之後的境界與內容將於未來資料片推出" : "Post-Nascent Soul content will be available in future expansions"}
              </p>

              <p className="text-xs text-jade italic">
                {isZh
                  ? "你的每一分支持，都將用於開發更多玩法與內容，並回饋至天道生態中的每位修士。"
                  : "Every bit of your support goes toward developing new content and giving back to every cultivator in the Tian Tao ecosystem."}
              </p>

              <div className="space-y-1.5">
                <Button className="w-full seal-glow font-heading" disabled>
                  {isZh ? "踏入仙途 — 10 USDC" : "Enter the Immortal Path — 10 USDC"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {isZh ? "即將開放" : "Coming Soon"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
