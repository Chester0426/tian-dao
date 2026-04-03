"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
          <CardHeader>
            <CardTitle className="font-heading text-lg">裝備</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">
              即將開放
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}
