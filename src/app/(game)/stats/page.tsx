"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGameState } from "@/components/mining-provider";
import { useI18n } from "@/lib/i18n";
import { getItem, type EquipSlotId } from "@/lib/items";
import { computeStatsBreakdown } from "@/lib/stats";

// Equipment slot definitions for the 3x5 grid
interface EquipSlot {
  id: EquipSlotId | "empty";
  label: string;
  labelEn: string;
  icon: React.ReactNode;
  hidden?: boolean;
}

const EQUIPMENT_SLOTS: EquipSlot[] = [
  { id: "empty", label: "", labelEn: "", icon: null, hidden: true },
  { id: "helmet", label: "頭盔", labelEn: "Helmet", icon: <><path d="M12 3C8 3 5 6.5 5 10.5V14h14v-3.5C19 6.5 16 3 12 3z" /><path d="M5 14v2c0 1 1 2 2 2h10c1 0 2-1 2-2v-2" /><path d="M9 10h6" /><path d="M5 14h14" /></> },
  { id: "empty", label: "", labelEn: "", icon: null, hidden: true },

  { id: "necklace", label: "項鍊", labelEn: "Necklace", icon: <><ellipse cx="12" cy="14" rx="6" ry="5" /><path d="M12 9v-3" /><circle cx="12" cy="19" r="1.5" fill="currentColor" /></> },
  { id: "shoulder", label: "護肩", labelEn: "Shoulder", icon: <><path d="M4 10c0-2 3-4 8-4s8 2 8 4" /><path d="M4 10v3h16v-3" /><path d="M8 13v2M16 13v2" /></> },
  { id: "cape", label: "披風", labelEn: "Cape", icon: <><path d="M8 4h8v2H8z" /><path d="M7 6c-1 4-2 10 0 14h10c2-4 1-10 0-14" /><path d="M9 6v12M15 6v12" /></> },

  { id: "main-hand", label: "左手武器", labelEn: "Main Hand", icon: <><path d="M12 2l-2 14" /><path d="M10 16l4-14" /><path d="M8 14h8" /><circle cx="12" cy="20" r="2" /></> },
  { id: "chest", label: "胸甲", labelEn: "Chest", icon: <><path d="M6 4h12v6c0 4-2 8-6 10-4-2-6-6-6-10z" /><path d="M9 4v6M15 4v6" /><path d="M6 10h12" /></> },
  { id: "off-hand", label: "右手武器", labelEn: "Off Hand", icon: <><path d="M12 2l-2 14" /><path d="M10 16l4-14" /><path d="M8 14h8" /><circle cx="12" cy="20" r="2" /></> },

  { id: "gloves", label: "手套", labelEn: "Gloves", icon: <><path d="M7 12V8c0-1 1-2 2-2s2 1 2 2" /><path d="M11 8V6c0-1 1-2 2-2s2 1 2 2v2" /><path d="M15 10V8c0-1 1-2 2-2" /><path d="M7 12c0 4 2 6 5 8 3-2 5-4 5-8" /></> },
  { id: "pants", label: "褲子", labelEn: "Pants", icon: <><path d="M7 4h10v8l-2 8h-2l-1-8-1 8H9l-2-8z" /><path d="M7 8h10" /></> },
  { id: "accessory", label: "飾品", labelEn: "Accessory", icon: <><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="3" /><path d="M12 7v-3M17 12h3M12 17v3M7 12H4" /></> },

  { id: "ring", label: "戒指", labelEn: "Ring", icon: <><circle cx="12" cy="13" r="5" /><circle cx="12" cy="13" r="3" /><path d="M10 8l2-4 2 4" /></> },
  { id: "boots", label: "靴子", labelEn: "Boots", icon: <><path d="M7 4v10h4v4h6v-6h-4V4" /><path d="M7 14h10" /><path d="M11 14v4" /></> },
  { id: "empty", label: "", labelEn: "", icon: null, hidden: true },
];

const STAT_DEFS = [
  { key: "hp" as const, name: "氣血", nameEn: "HP", color: "text-red-400", desc: "當氣血歸零時角色死亡", descEn: "Character dies when HP reaches 0" },
  { key: "mp" as const, name: "法力", nameEn: "MP", color: "text-blue-400", desc: "施展技能的消耗", descEn: "Consumed when using skills" },
  { key: "atk" as const, name: "外功", nameEn: "ATK", color: "text-spirit-gold", desc: "物理攻擊力", descEn: "Physical attack power" },
  { key: "int" as const, name: "內功", nameEn: "INT", color: "text-jade", desc: "法術攻擊力", descEn: "Magical attack power" },
  { key: "def" as const, name: "防禦", nameEn: "DEF", color: "text-blue-300", desc: "減少受到的傷害", descEn: "Reduces damage taken" },
  { key: "spd" as const, name: "攻速", nameEn: "SPD", color: "text-white/70", desc: "攻擊間隔", descEn: "Attack interval" },
  { key: "critRate" as const, name: "爆擊率", nameEn: "Crit%", unit: "%", color: "text-cinnabar", desc: "暴擊觸發機率", descEn: "Critical hit chance" },
  { key: "critDmg" as const, name: "爆擊傷害", nameEn: "CritDMG", unit: "%", color: "text-cinnabar", desc: "暴擊傷害倍率", descEn: "Critical hit damage multiplier" },
];

export default function StatsPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  // const router = useRouter();
  const gameState = useGameState();
  const inventory = gameState.inventory;

  const [equipment, setEquipment] = useState<Record<string, string>>({});
  const [bodyLevel, setBodyLevel] = useState(1);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  const breakdown = computeStatsBreakdown({ bodyLevel, equipment });
  const stats = breakdown.total;

  // Fetch equipment on mount
  useEffect(() => {
    fetch("/api/game/equip", { method: "GET" }).catch(() => {});
    // Equipment is stored in profile — fetch via a simple endpoint or use layout data
    // For now, read from a quick fetch
    fetch("/api/game/profile-data")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.equipment) setEquipment(d.equipment);
        if (d?.body_level) setBodyLevel(d.body_level);
      })
      .catch(() => {});
  }, []);

  const equip = async (slotId: string, itemType: string | null) => {
    setOpenSlot(null);
    const oldEquipped = equipment[slotId] ?? null;
    // Optimistic update equipment
    setEquipment((prev) => {
      const next = { ...prev };
      if (itemType) next[slotId] = itemType;
      else delete next[slotId];
      return next;
    });
    // Optimistic update inventory
    gameState.updateInventory((prev) => {
      let next = [...prev];
      // If equipping: remove item from inventory
      if (itemType) {
        next = next.map((inv) =>
          inv.item_type === itemType ? { ...inv, quantity: inv.quantity - 1 } : inv
        ).filter((inv) => inv.quantity > 0);
      }
      // If unequipping (or swapping): return old item to inventory
      if (oldEquipped) {
        const existing = next.find((inv) => inv.item_type === oldEquipped);
        if (existing) {
          next = next.map((inv) =>
            inv.item_type === oldEquipped ? { ...inv, quantity: inv.quantity + 1 } : inv
          );
        } else {
          next = [...next, { item_type: oldEquipped, quantity: 1 } as typeof prev[0]];
        }
      }
      return next;
    });
    await fetch("/api/game/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: slotId, item_type: itemType }),
    });
  };

  return (
    <TooltipProvider>
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {isZh ? "數值" : "Stats"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isZh ? "角色屬性與裝備" : "Character attributes and equipment"}
        </p>
        <Separator className="mt-4" />
      </header>

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Left — Stats */}
        <Card className="scroll-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg">{isZh ? "屬性" : "Attributes"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{isZh ? "主要屬性" : "Primary"}</p>
                <div className="space-y-3">
                  {STAT_DEFS.map((def) => {
                    const baseVal = breakdown.base[def.key];
                    const realmVal = breakdown.realm[def.key];
                    const equipVal = breakdown.equipment[def.key];
                    return (
                      <Tooltip key={def.key}>
                        <TooltipTrigger className="w-full">
                          <div className="flex items-center justify-between cursor-default rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-muted/30">
                            <span className="text-sm text-muted-foreground">{isZh ? def.name : def.nameEn}</span>
                            <span className={`font-heading text-sm tabular-nums ${def.color}`}>
                              {stats[def.key]}{def.unit ?? ""}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{isZh ? def.desc : def.descEn}</p>
                            <div className="text-[11px] border-t border-border/30 pt-1 mt-1 space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-foreground/70">{isZh ? "基礎" : "Base"}</span>
                                <span className="tabular-nums">{baseVal}</span>
                              </div>
                              {realmVal > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-spirit-gold">{isZh ? "境界" : "Realm"}</span>
                                  <span className="tabular-nums text-spirit-gold">+{realmVal}</span>
                                </div>
                              )}
                              {equipVal > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-jade">{isZh ? "裝備" : "Equipment"}</span>
                                  <span className="tabular-nums text-jade">+{equipVal}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-border/20 pt-0.5 mt-0.5">
                                <span className={`font-heading ${def.color}`}>{isZh ? "總計" : "Total"}</span>
                                <span className={`font-heading tabular-nums ${def.color}`}>{stats[def.key]}{def.unit ?? ""}</span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{isZh ? "次要屬性" : "Secondary"}</p>
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">
                  {isZh ? "即將開放" : "Coming soon"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right — Equipment */}
        <Card className="scroll-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg">{isZh ? "裝備" : "Equipment"}</CardTitle>
              <button type="button" className="text-xs font-heading text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline">
                {isZh ? "檢視裝備數值" : "View Stats"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">

            <div className="grid grid-cols-3 gap-2 mx-auto" style={{ maxWidth: "min(100%, 220px)" }}>
              {EQUIPMENT_SLOTS.map((slot, idx) => {
                if (slot.hidden) return <div key={`empty-${idx}`} className="aspect-square" />;

                const slotId = slot.id as EquipSlotId;
                const equippedItemType = equipment[slotId];
                const equippedItem = equippedItemType ? getItem(equippedItemType) : null;
                const isOpen = openSlot === slotId;

                // Items in inventory that fit this slot (exclude already equipped items)
                const availableItems = inventory.filter((inv) => {
                  const def = getItem(inv.item_type);
                  if (!def || def.equipSlot !== slotId || inv.quantity <= 0) return false;
                  // If this item is currently equipped in THIS slot, don't show it (it's already worn)
                  if (equippedItemType === inv.item_type) return false;
                  return true;
                });

                return (
                  <div key={slotId + "-" + idx} className="relative">
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          onClick={() => setOpenSlot(isOpen ? null : slotId)}
                          className={`group relative w-[64px] h-[64px] rounded-lg border transition-all duration-200 flex items-center justify-center overflow-hidden cursor-pointer ${
                            equippedItem
                              ? "border-spirit-gold/50 bg-spirit-gold/10"
                              : "border-border/30 bg-muted/10 hover:border-spirit-gold/40 hover:bg-spirit-gold/5"
                          }`}
                        >
                          <div className="absolute inset-[1px] rounded-[7px] border border-white/[0.03] pointer-events-none" />
                          {equippedItem ? (
                            <span className="text-xl">{equippedItem.icon}</span>
                          ) : (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/35 group-hover:text-muted-foreground/60 transition-colors">
                              {slot.icon}
                            </svg>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[180px] ">
                        {equippedItem ? (
                          <div className="space-y-1">
                            <p className="font-heading text-sm text-spirit-gold">{isZh ? equippedItem.nameZh : equippedItem.nameEn}</p>
                            <p className="text-[11px] text-muted-foreground">{isZh ? "部位" : "Slot"}: {isZh ? slot.label : slot.labelEn}</p>
                            <p className="text-[11px] text-muted-foreground">{isZh ? "裝備要求" : "Requires"}: {isZh ? equippedItem.requirementZh : equippedItem.requirementEn}</p>
                            {equippedItem.equipStats && (
                              <div className="text-[11px] border-t border-border/30 pt-1 mt-1 space-y-0.5">
                                {equippedItem.equipStats.hp && <p className="text-red-400">+{equippedItem.equipStats.hp} {isZh ? "氣血" : "HP"}</p>}
                                {equippedItem.equipStats.atk && <p className="text-spirit-gold">+{equippedItem.equipStats.atk} {isZh ? "外功" : "ATK"}</p>}
                                {equippedItem.equipStats.def && <p className="text-blue-300">+{equippedItem.equipStats.def} {isZh ? "防禦" : "DEF"}</p>}
                                {equippedItem.equipStats.mp && <p className="text-blue-400">+{equippedItem.equipStats.mp} {isZh ? "法力" : "MP"}</p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs">{isZh ? slot.label : slot.labelEn}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>

                    {/* Equip popover */}
                    {isOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenSlot(null)} />
                        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border/60 bg-card shadow-xl overflow-hidden">
                          <div className="px-3 py-2 border-b border-border/30 text-[11px] font-heading text-spirit-gold">
                            {isZh ? slot.label : slot.labelEn}
                          </div>
                          {/* Unequip option */}
                          {equippedItem && (
                            <button
                              type="button"
                              onClick={() => equip(slotId, null)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cinnabar hover:bg-cinnabar/10 transition-colors border-b border-border/20"
                            >
                              <span className="text-base">🚫</span>
                              <span className="flex-1 text-left font-heading">{isZh ? "卸下" : "Unequip"}</span>
                            </button>
                          )}
                          {/* Available items */}
                          {availableItems.length === 0 && !equippedItem && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              {isZh ? "無可裝備物品" : "No items available"}
                            </div>
                          )}
                          {availableItems.map((inv) => {
                            const meta = getItem(inv.item_type);
                            if (!meta) return null;
                            return (
                              <Tooltip key={inv.item_type}>
                                <TooltipTrigger>
                                  <button
                                    type="button"
                                    onClick={() => equip(slotId, inv.item_type)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                                  >
                                    <span className="text-base">{meta.icon}</span>
                                    <span className="flex-1 text-left font-heading truncate">{isZh ? meta.nameZh : meta.nameEn}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[180px] ">
                                  <div className="space-y-1">
                                    <p className="font-heading text-sm text-spirit-gold">{isZh ? meta.nameZh : meta.nameEn}</p>
                                    <p className="text-[11px] text-muted-foreground">{isZh ? "部位" : "Slot"}: {isZh ? slot.label : slot.labelEn}</p>
                                    <p className="text-[11px] text-muted-foreground">{isZh ? "裝備要求" : "Requires"}: {isZh ? meta.requirementZh : meta.requirementEn}</p>
                                    {meta.equipStats && (
                                      <div className="text-[11px] border-t border-border/30 pt-1 mt-1 space-y-0.5">
                                        {meta.equipStats.hp && <p className="text-red-400">+{meta.equipStats.hp} {isZh ? "氣血" : "HP"}</p>}
                                        {meta.equipStats.atk && <p className="text-spirit-gold">+{meta.equipStats.atk} {isZh ? "外功" : "ATK"}</p>}
                                        {meta.equipStats.def && <p className="text-blue-300">+{meta.equipStats.def} {isZh ? "防禦" : "DEF"}</p>}
                                        {meta.equipStats.mp && <p className="text-blue-400">+{meta.equipStats.mp} {isZh ? "法力" : "MP"}</p>}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <EquipmentSetSwitcher />
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}

function EquipmentSetSwitcher() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [activeSet, setActiveSet] = useState<1 | 2>(1);
  return (
    <div className="text-center space-y-2 pt-2">
      <p className="text-sm text-muted-foreground">{isZh ? "變更裝備套裝" : "Change Equipment Set"}</p>
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
