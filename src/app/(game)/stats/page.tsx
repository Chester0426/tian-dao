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

// 3x7 = 21 slots. Row 1 top → Row 7 bottom. Columns: left, center, right.
// Slot positions match Melvor-style equipment layout.
// SVG paths are simple silhouette icons.
interface EquipSlot {
  id: number;
  label: string;
  icon: React.ReactNode | null;
}

const EQUIPMENT_SLOTS: EquipSlot[] = [
  // Row 1
  { id: 1, label: "未定義", icon: null },
  { id: 2, label: "頭盔", icon: <><path d="M4 15c0-4.4 3.6-8 8-8s8 3.6 8 8" /><path d="M2 15h20" /><path d="M7 15v4h10v-4" /></> },
  { id: 3, label: "未定義", icon: null },
  // Row 2
  { id: 4, label: "未定義", icon: null },
  { id: 5, label: "未定義", icon: null },
  { id: 6, label: "未定義", icon: null },
  // Row 3
  { id: 7, label: "未定義", icon: null },
  { id: 8, label: "未定義", icon: null },
  { id: 9, label: "未定義", icon: null },
  // Row 4
  { id: 10, label: "未定義", icon: null },
  { id: 11, label: "未定義", icon: null },
  { id: 12, label: "未定義", icon: null },
  // Row 5
  { id: 13, label: "未定義", icon: null },
  { id: 14, label: "未定義", icon: null },
  { id: 15, label: "未定義", icon: null },
  // Row 6
  { id: 16, label: "未定義", icon: null },
  { id: 17, label: "未定義", icon: null },
  { id: 18, label: "未定義", icon: null },
  // Row 7
  { id: 19, label: "未定義", icon: null },
  { id: 20, label: "未定義", icon: null },
  { id: 21, label: "未定義", icon: null },
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

      <div className="grid gap-6 md:grid-cols-2">
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
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-center">裝備</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* View equipment stats button */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm font-heading text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline"
              >
                檢視裝備數值
              </button>
            </div>

            {/* 3 x 7 equipment grid */}
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {EQUIPMENT_SLOTS.map((slot) => (
                <Tooltip key={slot.id}>
                  <TooltipTrigger>
                    <button
                      type="button"
                      className="group relative w-[64px] h-[64px] rounded-lg border border-border/30 bg-muted/10 hover:border-spirit-gold/40 hover:bg-spirit-gold/5 transition-all duration-200 flex items-center justify-center overflow-hidden"
                    >
                      {/* Inner bevel effect */}
                      <div className="absolute inset-[1px] rounded-[7px] border border-white/[0.03] pointer-events-none" />
                      {/* Slot content */}
                      {slot.icon ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                          {slot.icon}
                        </svg>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/15 font-heading select-none">{slot.id}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {slot.label}
                  </TooltipContent>
                </Tooltip>
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

