"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 3x5 equipment grid. "hidden" slots are invisible spacers.
interface EquipSlot {
  id: string;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
}

const EQUIPMENT_SLOTS: EquipSlot[] = [
  // Row 1: _ 頭盔 _
  { id: "empty-1", label: "", icon: null, hidden: true },
  { id: "helmet", label: "頭盔", icon: <><path d="M12 3C8 3 5 6.5 5 10.5V14h14v-3.5C19 6.5 16 3 12 3z" /><path d="M5 14v2c0 1 1 2 2 2h10c1 0 2-1 2-2v-2" /><path d="M9 10h6" /><path d="M5 14h14" /></> },
  { id: "empty-2", label: "", icon: null, hidden: true },
  // Row 2: 項鍊 護肩 披風
  { id: "necklace", label: "項鍊", icon: <><ellipse cx="12" cy="14" rx="6" ry="5" /><path d="M12 9v-3" /><circle cx="12" cy="19" r="1.5" fill="currentColor" /></> },
  { id: "shoulder", label: "護肩", icon: <><path d="M4 10c0-2 3-4 8-4s8 2 8 4" /><path d="M4 10v3h16v-3" /><path d="M8 13v2M16 13v2" /></> },
  { id: "cape", label: "披風", icon: <><path d="M8 4h8v2H8z" /><path d="M7 6c-1 4-2 10 0 14h10c2-4 1-10 0-14" /><path d="M9 6v12M15 6v12" /></> },
  // Row 3: 左手 胸甲 右手
  { id: "main-hand", label: "左手武器", icon: <><path d="M12 2l-2 14" /><path d="M10 16l4-14" /><path d="M8 14h8" /><circle cx="12" cy="20" r="2" /></> },
  { id: "chest", label: "胸甲", icon: <><path d="M6 4h12v6c0 4-2 8-6 10-4-2-6-6-6-10z" /><path d="M9 4v6M15 4v6" /><path d="M6 10h12" /></> },
  { id: "off-hand", label: "右手武器", icon: <><path d="M12 2l-2 14" /><path d="M10 16l4-14" /><path d="M8 14h8" /><circle cx="12" cy="20" r="2" /></> },
  // Row 4: 手套 褲子 飾品
  { id: "gloves", label: "手套", icon: <><path d="M7 12V8c0-1 1-2 2-2s2 1 2 2" /><path d="M11 8V6c0-1 1-2 2-2s2 1 2 2v2" /><path d="M15 10V8c0-1 1-2 2-2" /><path d="M7 12c0 4 2 6 5 8 3-2 5-4 5-8" /></> },
  { id: "pants", label: "褲子", icon: <><path d="M7 4h10v8l-2 8h-2l-1-8-1 8H9l-2-8z" /><path d="M7 8h10" /></> },
  { id: "accessory", label: "飾品", icon: <><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="3" /><path d="M12 7v-3M17 12h3M12 17v3M7 12H4" /></> },
  // Row 5: 戒指 靴子 _
  { id: "ring", label: "戒指", icon: <><circle cx="12" cy="13" r="5" /><circle cx="12" cy="13" r="3" /><path d="M10 8l2-4 2 4" /></> },
  { id: "boots", label: "靴子", icon: <><path d="M7 4v10h4v4h6v-6h-4V4" /><path d="M7 14h10" /><path d="M11 14v4" /></> },
  { id: "empty-3", label: "", icon: null, hidden: true },
];

const STATS = [
  { name: "氣血", value: 100, color: "text-red-400", desc: "當氣血歸零時角色死亡" },
  { name: "法力", value: 0, color: "text-blue-400", desc: "設計中" },
  { name: "外功", value: 1, color: "text-spirit-gold", desc: "設計中" },
  { name: "內功", value: 0, color: "text-jade", desc: "設計中" },
  { name: "防禦", value: 0, color: "text-white/70", desc: "設計中" },
  { name: "攻速", value: 0, color: "text-white/70", desc: "設計中" },
  { name: "爆擊率", value: 0, unit: "%", color: "text-cinnabar", desc: "設計中" },
  { name: "爆擊傷害", value: 0, unit: "%", color: "text-cinnabar", desc: "設計中" },
];


export default function StatsPage() {
  return (
    <TooltipProvider>
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          數值
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          角色屬性與裝備
        </p>
        <Separator className="mt-4" />
      </header>

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Left — Stats */}
        <Card className="scroll-surface">
          <CardHeader>
            <CardTitle className="font-heading text-lg">屬性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Left — Main Stats */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">主要屬性</p>
                <div className="space-y-3">
                  {STATS.map((stat) => (
                    <Tooltip key={stat.name}>
                      <TooltipTrigger className="w-full">
                        <div className="flex items-center justify-between cursor-default rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-muted/30">
                          <span className="text-sm text-muted-foreground">{stat.name}</span>
                          <span className={`font-heading text-sm tabular-nums ${stat.color}`}>
                            {stat.value}{stat.unit ?? ""}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{stat.desc}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              {/* Right — Special Stats */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">次要屬性</p>
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">
                  即將開放
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right — Equipment */}
        <Card className="scroll-surface">
          <CardContent className="pt-4 pb-4 space-y-2">
            {/* Title + stats link in one row */}
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold">裝備</h3>
              <button
                type="button"
                className="text-xs font-heading text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline"
              >
                檢視裝備數值
              </button>
            </div>

            {/* 3 x 7 equipment grid — responsive sizing */}
            <div className="grid grid-cols-3 gap-1.5 mx-auto" style={{ maxWidth: "min(100%, 192px)" }}>
              {EQUIPMENT_SLOTS.map((slot) => (
                slot.hidden ? (
                  <div key={slot.id} className="aspect-square" />
                ) : (
                  <Tooltip key={slot.id}>
                    <TooltipTrigger>
                      <div
                        className="group relative aspect-square rounded-lg border border-border/30 bg-muted/10 hover:border-spirit-gold/40 hover:bg-spirit-gold/5 transition-all duration-200 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        <div className="absolute inset-[1px] rounded-[7px] border border-white/[0.03] pointer-events-none" />
                        {slot.icon ? (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/35 group-hover:text-muted-foreground/60 transition-colors">
                            {slot.icon}
                          </svg>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/15 font-heading select-none">{slot.id}</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {slot.label}
                    </TooltipContent>
                  </Tooltip>
                )
              ))}
            </div>

            {/* Equipment set switcher */}
            <EquipmentSetSwitcher />
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}

function EquipmentSetSwitcher() {
  const [activeSet, setActiveSet] = useState<1 | 2>(1);
  return (
    <div className="text-center space-y-2 pt-2">
      <p className="text-sm text-muted-foreground">變更裝備套裝</p>
      <div className="flex items-center justify-center gap-2">
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setActiveSet(n)}
            className={`w-10 h-10 rounded-md font-heading font-bold flex items-center justify-center transition-colors ${
              activeSet === n
                ? "bg-jade text-background"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-border/40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

