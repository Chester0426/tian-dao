"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { useGameState } from "@/components/mining-provider";
import { COMBAT_ZONES } from "@/lib/combat";
import { ITEMS } from "@/lib/items";

export default function AdventurePage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const gameState = useGameState();

  const [showDrops, setShowDrops] = useState<string | null>(null);
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({});
  const [collectError, setCollectError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [lootBoxCollapsed, setLootBoxCollapsed] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    setCollectError("");
    const result = await gameState.collectCombatLoot();
    if (!result.ok) setCollectError(isZh ? (result.error ?? "收取失敗") : (result.error ?? "Failed"));
    setCollecting(false);
  };

  return (
    <TooltipProvider>
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {isZh ? "遊歷" : "Adventure"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? "探索各地,挑戰強敵" : "Explore the world and challenge foes"}
          </p>
          <Separator className="mt-4" />
        </header>

        {/* Combat panel — only when fighting */}
        {gameState.isCombating && gameState.combatMonster && (
          <Card className="scroll-surface mb-6 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cinnabar/60 via-cinnabar to-cinnabar/60" />
            <CardContent className="pt-5 pb-5 space-y-4">
              {/* Player vs Monster */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                {/* Player */}
                <div className="text-center space-y-2">
                  <div className="text-4xl">🧘</div>
                  <p className="font-heading text-sm">{isZh ? "你" : "You"}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-muted-foreground">HP</span>
                      <span className="text-red-400 tabular-nums font-heading">{gameState.playerHp}/{gameState.playerMaxHp}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (gameState.playerHp / gameState.playerMaxHp) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">{isZh ? "攻擊" : "Attack"} 3.0s</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div className="h-full rounded-full bg-spirit-gold/70" style={{ width: `${gameState.combatPlayerProgress * 100}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-8 text-2xl font-heading text-cinnabar">⚔️</div>

                {/* Monster */}
                <div className="text-center space-y-2">
                  <div className="text-4xl">{gameState.combatMonster.icon}</div>
                  <p className="font-heading text-sm">{isZh ? gameState.combatMonster.nameZh : gameState.combatMonster.nameEn}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-muted-foreground">HP</span>
                      <span className="text-red-400 tabular-nums font-heading">{gameState.monsterHp}/{gameState.combatMonster.hp}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full rounded-full bg-gradient-to-r from-cinnabar to-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (gameState.monsterHp / gameState.combatMonster.hp) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">{isZh ? "攻擊" : "Attack"} {gameState.combatMonster.attackSpeed}s</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div className="h-full rounded-full bg-cinnabar/70" style={{ width: `${gameState.combatMonsterProgress * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Combat log */}
              <div className="rounded-lg border border-border/30 bg-muted/10 px-4 py-3 min-h-[80px] max-h-[120px] overflow-y-auto">
                {gameState.combatLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">{isZh ? "戰鬥開始..." : "Battle begins..."}</p>
                ) : (
                  <div className="space-y-0.5">
                    {gameState.combatLogs.map((log) => (
                      <p key={log.id} className={`text-xs ${log.color}`}>{log.text}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <Button onClick={gameState.stopCombat} className="bg-cinnabar hover:bg-cinnabar/90 text-white font-heading px-8">
                  {isZh ? "撤退" : "Retreat"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loot box — separate card, always visible */}
        <Card className="scroll-surface mb-6 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-spirit-gold/60 via-spirit-gold to-spirit-gold/60" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="font-heading text-base font-bold text-spirit-gold">{isZh ? "戰利品箱" : "Loot Box"}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{gameState.combatLootSlots.length}/100</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCollect}
                  disabled={gameState.combatLootSlots.length === 0 || collecting}
                  className="bg-jade hover:bg-jade/90 text-background font-heading px-4"
                >
                  {collecting ? (isZh ? "收取中..." : "Collecting...") : (isZh ? "收取" : "Collect")}
                </Button>
                <button
                  type="button"
                  onClick={() => setLootBoxCollapsed((v) => !v)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  {lootBoxCollapsed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {!lootBoxCollapsed && gameState.combatLootSlots.length > 0 ? (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                {gameState.combatLootSlots.map((slot, idx) => {
                  const meta = ITEMS[slot.item_type];
                  return (
                    <Tooltip key={`${slot.item_type}-${idx}`}>
                      <TooltipTrigger>
                        <div className="aspect-square rounded-md border border-border/30 bg-muted/15 flex flex-col items-center justify-center relative">
                          <span className="text-lg">{meta?.icon ?? "○"}</span>
                          {slot.quantity > 1 && (
                            <span className="absolute bottom-0.5 right-1 text-[9px] font-heading text-foreground tabular-nums">{slot.quantity}</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="block">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-heading text-sm">{meta ? (isZh ? meta.nameZh : meta.nameEn) : slot.item_type}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">×{slot.quantity}</span>
                        </div>
                        {meta?.hintZh && <p className="text-[11px] text-jade">{isZh ? meta.hintZh : meta.hintEn}</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{isZh ? "空" : "Empty"}</p>
            )}
            {collectError && <p className="text-xs text-cinnabar mt-2">{collectError}</p>}
          </CardContent>
        </Card>

        {/* Zone cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {COMBAT_ZONES.map((zone) => (
          <Card key={zone.id} className="scroll-surface overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cinnabar/60 via-cinnabar to-cinnabar/60" />
            <CardContent className="pt-2 pb-3">
              <button
                type="button"
                onClick={() => setCollapsedZones((prev) => ({ ...prev, [zone.id]: !prev[zone.id] }))}
                className="w-full flex items-center gap-4 text-left hover:opacity-80 transition-opacity"
              >
                <div className="text-4xl">🏛️</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl font-bold">{isZh ? zone.nameZh : zone.nameEn}</h2>
                    <Badge variant="outline" className="border-spirit-gold/30 text-spirit-gold text-xs">{isZh ? zone.realmZh : zone.realmEn}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{isZh ? zone.descZh : zone.descEn}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/50 shrink-0 transition-transform ${collapsedZones[zone.id] ? "-rotate-90" : ""}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {!collapsedZones[zone.id] && (<>
              <Separator className="mt-4 mb-3" />
              <div className="grid grid-cols-[60px_1fr_auto] gap-3 px-2 mb-2">
                <span className="text-[10px] text-muted-foreground/60 font-heading text-center">#</span>
                <span className="text-[10px] text-muted-foreground/60 font-heading">{isZh ? "名稱" : "Name"}</span>
                <span className="text-[10px] text-muted-foreground/60 font-heading text-right">{isZh ? "選項" : "Options"}</span>
              </div>
              <div className="space-y-0">
                {zone.monsters.map((monster, idx) => (
                  <div key={monster.id}>
                    {idx > 0 && <Separator />}
                    <div className="grid grid-cols-[60px_1fr_auto] gap-3 items-center px-2 py-3">
                      <div className="text-center text-3xl">{monster.icon}</div>
                      <div>
                        <p className="font-heading text-sm font-bold">{isZh ? monster.nameZh : monster.nameEn}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-red-400 text-xs">❤️</span>
                          <span className="text-red-400 text-xs font-heading">{monster.hp}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => gameState.startCombat(monster)}
                          disabled={gameState.isCombating}
                          className="bg-cinnabar/80 hover:bg-cinnabar text-white font-heading px-6"
                        >
                          {isZh ? "戰鬥" : "Fight"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDrops(showDrops === monster.id ? null : monster.id)}
                          className="font-heading px-6 text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                        >
                          {isZh ? "掉落物" : "Drops"}
                        </Button>
                      </div>
                    </div>
                    {showDrops === monster.id && (
                      <div className="px-2 pb-3 pl-[72px]">
                        <div className="rounded-md border border-border/30 bg-muted/10 px-3 py-2 space-y-1">
                          {monster.drops.map((drop) => {
                            const meta = ITEMS[drop.item_type];
                            return (
                              <div key={drop.item_type} className="flex items-center gap-2 text-xs">
                                <span>{meta?.icon ?? "○"}</span>
                                <span className="text-muted-foreground">{meta ? (isZh ? meta.nameZh : meta.nameEn) : drop.item_type}</span>
                                <span className="text-muted-foreground/60 tabular-nums">×{drop.quantity}</span>
                              </div>
                            );
                          })}
                          <div className="flex items-center gap-2 text-xs border-t border-border/20 pt-1 mt-1">
                            <span>💪</span>
                            <span className="text-spirit-gold">{isZh ? "煉體經驗" : "Body XP"}</span>
                            <span className="text-spirit-gold tabular-nums font-heading">+{monster.bodyXp}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </>)}
            </CardContent>
          </Card>
        ))}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
