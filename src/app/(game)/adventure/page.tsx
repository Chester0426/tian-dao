"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useGameState } from "@/components/mining-provider";
import { COMBAT_ZONES, type Monster } from "@/lib/combat";
import { computeStats } from "@/lib/stats";
import { ITEMS, hasTag } from "@/lib/items";

interface CombatLog {
  id: number;
  text: string;
  color: string;
}

export default function AdventurePage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const gameState = useGameState();

  const playerStats = computeStats({
    bodyLevel: gameState.bodyLevel ?? 1,
    equipment: gameState.equipment ?? {},
  });

  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [playerHp, setPlayerHp] = useState(playerStats.hp);
  const [monsterHp, setMonsterHp] = useState(0);
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [monsterProgress, setMonsterProgress] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [showDrops, setShowDrops] = useState<string | null>(null);
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({});
  // Loot box: array of slots. Equipment = 1 per slot. Regular items stack.
  interface LootSlot { item_type: string; quantity: number }
  const [lootSlots, setLootSlots] = useState<LootSlot[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState("");

  const LOOT_BOX_LIMIT = 100;
  const lootSlotCount = lootSlots.length;

  const logIdRef = useRef(0);
  const playerTickRef = useRef(0);
  const monsterTickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const monsterRef = useRef<Monster | null>(null);
  const playerHpRef = useRef(playerStats.hp);
  const monsterHpRef = useRef(0);

  const ATTACK_INTERVAL = 3000;

  const addLog = useCallback((text: string, color: string) => {
    const id = ++logIdRef.current;
    setLogs((prev) => [...prev.slice(-6), { id, text, color }]);
  }, []);

  // Combat loop
  useEffect(() => {
    if (!isFighting || !monsterRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPlayerProgress(0);
      setMonsterProgress(0);
      return;
    }

    playerTickRef.current = Date.now();
    monsterTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const monster = monsterRef.current!;

      const pElapsed = now - playerTickRef.current;
      setPlayerProgress(Math.min(pElapsed / ATTACK_INTERVAL, 1));

      const mElapsed = now - monsterTickRef.current;
      setMonsterProgress(Math.min(mElapsed / (monster.attackSpeed * 1000), 1));

      // Player attacks
      if (pElapsed >= ATTACK_INTERVAL) {
        const dmg = Math.max(1, playerStats.atk - monster.def);
        monsterHpRef.current = Math.max(0, monsterHpRef.current - dmg);
        setMonsterHp(monsterHpRef.current);
        addLog(
          isZh ? `你對${monster.nameZh}造成 ${dmg} 點傷害` : `You deal ${dmg} to ${monster.nameEn}`,
          "text-spirit-gold"
        );
        playerTickRef.current = now;

        if (monsterHpRef.current <= 0) {
          addLog(
            isZh ? `${monster.nameZh}被擊敗！` : `${monster.nameEn} defeated!`,
            "text-jade"
          );
          setKillCount((c) => c + 1);
          gameState.addNotification(monster.icon, isZh ? `${monster.nameZh} 擊敗` : `${monster.nameEn} defeated`, 1, "text-cinnabar");
          // Drops go to loot box
          setLootSlots((prev) => {
            const next = [...prev];
            for (const drop of monster.drops) {
              const isEquip = hasTag(drop.item_type, "equipment");
              for (let i = 0; i < drop.quantity; i++) {
                if (next.length >= LOOT_BOX_LIMIT) {
                  addLog(isZh ? "戰利品箱已滿！" : "Loot box full!", "text-cinnabar");
                  break;
                }
                if (isEquip) {
                  // Equipment: each piece occupies its own slot
                  next.push({ item_type: drop.item_type, quantity: 1 });
                } else {
                  // Regular item: stack in existing slot
                  const existing = next.find((s) => s.item_type === drop.item_type);
                  if (existing) {
                    existing.quantity += 1;
                  } else {
                    next.push({ item_type: drop.item_type, quantity: 1 });
                  }
                }
              }
              const meta = ITEMS[drop.item_type];
              if (meta) {
                gameState.addNotification(meta.icon, isZh ? meta.nameZh : meta.nameEn, drop.quantity, meta.color);
              }
            }
            return next;
          });
          if (monster.bodyXp > 0) {
            gameState.addNotification("💪", isZh ? "煉體經驗" : "Body XP", monster.bodyXp, "text-spirit-gold");
          }

          monsterHpRef.current = monster.hp;
          setMonsterHp(monster.hp);
          playerTickRef.current = now;
          monsterTickRef.current = now;
        }
      }

      // Monster attacks
      if (mElapsed >= monster.attackSpeed * 1000) {
        const dmg = Math.max(1, monster.atk - playerStats.def);
        playerHpRef.current = Math.max(0, playerHpRef.current - dmg);
        setPlayerHp(playerHpRef.current);
        addLog(
          isZh ? `${monster.nameZh}對你造成 ${dmg} 點傷害` : `${monster.nameEn} deals ${dmg} to you`,
          "text-cinnabar"
        );
        monsterTickRef.current = now;

        if (playerHpRef.current <= 0) {
          addLog(isZh ? "你被擊敗了！" : "You were defeated!", "text-cinnabar");
          setIsFighting(false);
          monsterRef.current = null;
          // Keep panel visible for loot collection
          return;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFighting]);

  const collectLoot = async () => {
    if (lootSlots.length === 0) return;
    setCollectError("");
    setCollecting(true);
    // Aggregate slots into { item_type: total_quantity }
    const aggregated: Record<string, number> = {};
    for (const slot of lootSlots) {
      aggregated[slot.item_type] = (aggregated[slot.item_type] ?? 0) + slot.quantity;
    }
    try {
      const res = await fetch("/api/game/collect-loot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: aggregated }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCollectError(isZh ? (data.error ?? "收取失敗") : (data.error_en ?? data.error ?? "Failed"));
        setCollecting(false);
        return;
      }
      setLootSlots([]);
      addLog(isZh ? "戰利品已收取！" : "Loot collected!", "text-jade");
    } catch {
      setCollectError(isZh ? "收取失敗" : "Collection failed");
    }
    setCollecting(false);
  };

  const startFight = (monster: Monster) => {
    // Stop other activities
    if (gameState.isMining) gameState.stopMining();
    if (gameState.isMeditating) gameState.stopMeditation();
    setSelectedMonster(monster);
    monsterRef.current = monster;
    monsterHpRef.current = monster.hp;
    playerHpRef.current = playerStats.hp;
    setMonsterHp(monster.hp);
    setPlayerHp(playerStats.hp);
    setLogs([]);
    setKillCount(0);
    setIsFighting(true);
    // Register combat session server-side
    fetch("/api/game/start-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "combat", requested_at: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  };

  const stopFight = () => {
    setIsFighting(false);
    monsterRef.current = null;
    setSelectedMonster(null);
    setPlayerHp(playerStats.hp);
    fetch("/api/game/stop-activity", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  };

  return (
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

        {/* Combat view */}
        {/* Combat panel — always visible */}
        {(
          <Card className="scroll-surface mb-6 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cinnabar/60 via-cinnabar to-cinnabar/60" />
            <CardContent className="pt-5 pb-5 space-y-4">
              {/* Player vs Monster — only when actively fighting */}
              {isFighting && selectedMonster && (<>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                {/* Player */}
                <div className="text-center space-y-2">
                  <div className="text-4xl">🧘</div>
                  <p className="font-heading text-sm">{isZh ? "你" : "You"}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-muted-foreground">HP</span>
                      <span className="text-red-400 tabular-nums font-heading">{playerHp}/{playerStats.hp}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (playerHp / playerStats.hp) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">{isZh ? "攻擊" : "Attack"} 3.0s</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div className="h-full rounded-full bg-spirit-gold/70" style={{ width: `${playerProgress * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-center gap-3">
                    <span>ATK <span className="text-spirit-gold font-heading">{playerStats.atk}</span></span>
                    <span>DEF <span className="text-blue-300 font-heading">{playerStats.def}</span></span>
                  </div>
                </div>

                <div className="pt-8 text-2xl font-heading text-cinnabar">⚔️</div>

                {/* Monster */}
                <div className="text-center space-y-2">
                  <div className="text-4xl">{selectedMonster.icon}</div>
                  <p className="font-heading text-sm">{isZh ? selectedMonster.nameZh : selectedMonster.nameEn}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-muted-foreground">HP</span>
                      <span className="text-red-400 tabular-nums font-heading">{monsterHp}/{selectedMonster.hp}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full rounded-full bg-gradient-to-r from-cinnabar to-red-400 transition-all duration-200" style={{ width: `${Math.max(0, (monsterHp / selectedMonster.hp) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">{isZh ? "攻擊" : "Attack"} {selectedMonster.attackSpeed}s</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div className="h-full rounded-full bg-cinnabar/70" style={{ width: `${monsterProgress * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-center gap-3">
                    <span>ATK <span className="text-spirit-gold font-heading">{selectedMonster.atk}</span></span>
                    <span>DEF <span className="text-blue-300 font-heading">{selectedMonster.def}</span></span>
                  </div>
                </div>
              </div>

              {killCount > 0 && (
                <div className="text-center text-xs text-muted-foreground">
                  {isZh ? "擊殺數" : "Kills"}: <span className="text-cinnabar font-heading">{killCount}</span>
                </div>
              )}

              {/* Combat log */}
              <div className="rounded-lg border border-border/30 bg-muted/10 px-4 py-3 min-h-[80px] max-h-[120px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">{isZh ? "戰鬥開始..." : "Battle begins..."}</p>
                ) : (
                  <div className="space-y-0.5">
                    {logs.map((log) => (
                      <p key={log.id} className={`text-xs ${log.color}`}>{log.text}</p>
                    ))}
                  </div>
                )}
              </div>

              </>)}

              {isFighting && (
                <div className="flex justify-center">
                  <Button onClick={stopFight} className="bg-cinnabar hover:bg-cinnabar/90 text-white font-heading px-8">
                    {isZh ? "撤退" : "Retreat"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loot box — separate card */}
        <Card className="scroll-surface mb-6 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-spirit-gold/60 via-spirit-gold to-spirit-gold/60" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="font-heading text-base font-bold text-spirit-gold">{isZh ? "戰利品箱" : "Loot Box"}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{lootSlotCount}/{LOOT_BOX_LIMIT}</span>
              </div>
              <Button
                size="sm"
                onClick={collectLoot}
                disabled={lootSlots.length === 0 || collecting}
                className="bg-jade hover:bg-jade/90 text-background font-heading px-4"
              >
                {collecting ? (isZh ? "收取中..." : "Collecting...") : (isZh ? "收取" : "Collect")}
              </Button>
            </div>
            {lootSlots.length > 0 ? (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                {lootSlots.map((slot, idx) => {
                  const meta = ITEMS[slot.item_type];
                  return (
                    <div
                      key={`${slot.item_type}-${idx}`}
                      className="aspect-square rounded-md border border-border/30 bg-muted/15 flex flex-col items-center justify-center relative"
                    >
                      <span className="text-lg">{meta?.icon ?? "○"}</span>
                      {slot.quantity > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-heading text-foreground tabular-nums">
                          {slot.quantity}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{isZh ? "空" : "Empty"}</p>
            )}
            {collectError && (
              <p className="text-xs text-cinnabar mt-2">{collectError}</p>
            )}
          </CardContent>
        </Card>

        {/* Zone cards — 3 per row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMBAT_ZONES.map((zone) => (
          <Card key={zone.id} className="scroll-surface overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cinnabar/60 via-cinnabar to-cinnabar/60" />
            <CardContent className="pt-5 pb-5">
              {/* Zone header — click to toggle */}
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

              {/* Table header */}
              <div className="grid grid-cols-[60px_1fr_auto] gap-3 px-2 mb-2">
                <span className="text-[10px] text-muted-foreground/60 font-heading text-center">#</span>
                <span className="text-[10px] text-muted-foreground/60 font-heading">{isZh ? "名稱" : "Name"}</span>
                <span className="text-[10px] text-muted-foreground/60 font-heading text-right">{isZh ? "選項" : "Options"}</span>
              </div>

              {/* Monster rows */}
              <div className="space-y-0">
                {zone.monsters.map((monster, idx) => (
                  <div key={monster.id}>
                    {idx > 0 && <Separator />}
                    <div className="grid grid-cols-[60px_1fr_auto] gap-3 items-center px-2 py-3">
                      {/* Icon */}
                      <div className="text-center text-3xl">{monster.icon}</div>

                      {/* Info */}
                      <div>
                        <p className="font-heading text-sm font-bold">{isZh ? monster.nameZh : monster.nameEn}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isZh ? "煉體期" : "Body Refining"} {monster.id === "drunkard" ? "1" : "5"} {isZh ? "級" : "Lv"}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-red-400 text-xs">❤️</span>
                          <span className="text-red-400 text-xs font-heading">{monster.hp}</span>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => startFight(monster)}
                          disabled={isFighting}
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

                    {/* Drops panel */}
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
  );
}
