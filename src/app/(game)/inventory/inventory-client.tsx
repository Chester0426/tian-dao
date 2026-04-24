"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { InventoryItem } from "@/lib/types";
import { getItem, ITEMS } from "@/lib/items";
import { useI18n } from "@/lib/i18n";

type FilterTab = "all" | "ore" | "equipment" | "consumable" | "book" | "other";

function getFilterTab(itemType: string): FilterTab {
  const def = ITEMS[itemType];
  if (!def) return "other";
  if (def.tags.includes("equipment")) return "equipment";
  if (def.tags.includes("consumable")) return "consumable";
  if (def.tags.includes("book") || def.tags.includes("tome")) return "book";
  if (def.tags.includes("spirit_stone")) return "ore";
  if (!def.tags.length || itemType.endsWith("_ore") || itemType.endsWith("_bar") || ["coal"].includes(itemType)) return "ore";
  return "other";
}

export function InventoryClient({
  inventory: initialInventory,
  totalSlots,
  daoPoints: initialDaoPoints,
}: {
  inventory: InventoryItem[];
  totalSlots: number;
  daoPoints: number;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [inventory, setInventory] = useState(initialInventory);
  const [daoPoints, setDaoPoints] = useState(initialDaoPoints);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [sellQty, setSellQty] = useState(1);
  const [sellQtyInput, setSellQtyInput] = useState("1");
  const [selling, setSelling] = useState(false);

  const slotsUsed = new Set(inventory.map((i) => i.item_type)).size;

  const filteredInventory = filterTab === "all"
    ? inventory
    : inventory.filter((i) => getFilterTab(i.item_type) === filterTab);

  const selectedInv = selectedItem ? inventory.find((i) => i.item_type === selectedItem) : null;
  const selectedDef = selectedItem ? getItem(selectedItem) : null;

  const handleSelectItem = (itemType: string) => {
    setSelectedItem(itemType === selectedItem ? null : itemType);
    const item = inventory.find((i) => i.item_type === itemType);
    const q = item?.quantity ?? 1;
    setSellQty(q);
    setSellQtyInput(String(q));
  };

  const handleSell = async () => {
    if (!selectedItem || sellQty <= 0) return;
    setSelling(true);
    try {
      const res = await fetch("/api/game/sacrifice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: selectedItem, quantity: sellQty }),
      });
      if (res.ok) {
        const data = await res.json();
        setDaoPoints(data.dao_points_total);
        setInventory((prev) =>
          prev
            .map((i) => i.item_type === selectedItem ? { ...i, quantity: i.quantity - sellQty } : i)
            .filter((i) => i.quantity > 0)
        );
        const remaining = (selectedInv?.quantity ?? 0) - sellQty;
        if (remaining <= 0) setSelectedItem(null);
        else { setSellQty(Math.min(sellQty, remaining)); setSellQtyInput(String(Math.min(sellQty, remaining))); }
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setSelling(false);
    }
  };

  const TABS: { key: FilterTab; labelZh: string; labelEn: string }[] = [
    { key: "all", labelZh: "全部", labelEn: "All" },
    { key: "ore", labelZh: "礦石", labelEn: "Ores" },
    { key: "equipment", labelZh: "裝備", labelEn: "Equip" },
    { key: "consumable", labelZh: "食物", labelEn: "Food" },
    { key: "book", labelZh: "書籍", labelEn: "Books" },
    { key: "other", labelZh: "其他", labelEn: "Other" },
  ];

  const SLOT_NAMES: Record<string, string> = {
    "helmet": isZh ? "頭盔" : "Helmet", "shoulder": isZh ? "護肩" : "Shoulder",
    "cape": isZh ? "披風" : "Cape", "necklace": isZh ? "項鍊" : "Necklace",
    "main-hand": isZh ? "主手" : "Main Hand", "off-hand": isZh ? "副手" : "Off Hand",
    "chest": isZh ? "胸甲" : "Chest", "gloves": isZh ? "手套" : "Gloves",
    "pants": isZh ? "褲子" : "Pants", "accessory": isZh ? "飾品" : "Accessory",
    "ring": isZh ? "戒指" : "Ring", "boots": isZh ? "靴子" : "Boots",
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Top info bar */}
        <div
          className="rounded-xl mb-6 px-5 py-4"
          style={{ background: "rgba(25,30,35,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/nav-items/nav-inventory.png" alt="" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="font-heading text-2xl font-bold">{isZh ? "儲物袋" : "Inventory"}</h1>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {isZh ? "空間" : "Space"} <span className="text-white font-bold">{slotsUsed}</span> / {totalSlots}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">{isZh ? "銀兩" : "Silver"}</p>
              <p className="font-heading text-lg text-spirit-gold tabular-nums">{daoPoints.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1.5 mb-6 overflow-x-auto rounded-lg px-3 py-2"
          style={{ background: "rgba(25,30,35,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                filterTab === tab.key
                  ? "bg-jade/20 text-jade border border-jade/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
              }`}
            >
              {isZh ? tab.labelZh : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Main layout */}
        <div className="flex gap-6 flex-col md:flex-row">
          {/* Left: Item grid */}
          <div
            className="flex-1 min-w-0 rounded-xl p-4"
            style={{ background: "rgba(25,30,35,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              <TooltipProvider>
                {filteredInventory.map((item) => {
                  const display = getItem(item.item_type);
                  const isSelected = selectedItem === item.item_type;
                  return (
                    <Tooltip key={item.item_type}>
                      <TooltipTrigger
                        onClick={() => handleSelectItem(item.item_type)}
                        className={`relative aspect-square rounded-md transition-all cursor-pointer w-full ${
                          isSelected
                            ? "ring-2 ring-jade shadow-[0_0_8px_rgba(62,207,165,0.3)]"
                            : "hover:brightness-125"
                        }`}
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          border: isSelected ? "1px solid rgba(62,207,165,0.6)" : "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-1">
                          {display?.image ? (
                            <img src={display.image} alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]" />
                          ) : (
                            <span className={`text-lg ${display?.color ?? "text-foreground"}`}>{display?.icon ?? "?"}</span>
                          )}
                        </div>
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-white bg-black/60 rounded px-1 leading-tight">
                          {item.quantity.toLocaleString()}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="block p-0 min-w-[200px]">
                        <div className="flex gap-3 p-3">
                          {display?.image && (
                            <div className="shrink-0 w-12 h-12 rounded-md bg-muted/20 border border-border/30 flex items-center justify-center">
                              <img src={display.image} alt="" className="w-10 h-10 object-contain" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-heading text-sm leading-tight">{display ? (isZh ? display.nameZh : display.nameEn) : item.item_type}</p>
                            {display?.equipSlot && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {display.requirementZh && <span className="text-spirit-gold/70">{isZh ? display.requirementZh : display.requirementEn}</span>}
                                {display.requirementZh && <span className="mx-1 text-muted-foreground/40">|</span>}
                                {SLOT_NAMES[display.equipSlot] ?? display.equipSlot}
                              </p>
                            )}
                            {display?.hintZh && (
                              <p className="text-[11px] text-jade mt-1">{isZh ? display.hintZh : display.hintEn}</p>
                            )}
                          </div>
                        </div>
                        {(display?.healHp || display?.equipStats) && (
                          <div className="border-t border-border/30 px-3 py-2 space-y-1">
                            {display?.healHp && (
                              <div className="text-[11px] text-jade">+{display.healHp} {isZh ? "氣血" : "HP"}</div>
                            )}
                            {display?.equipStats && (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                {display.equipStats.hp ? <span className="text-red-400">{isZh ? "氣血" : "HP"} +{display.equipStats.hp}</span> : null}
                                {display.equipStats.atk ? <span className="text-spirit-gold">{isZh ? "外功" : "ATK"} +{display.equipStats.atk}</span> : null}
                                {display.equipStats.def ? <span className="text-blue-300">{isZh ? "防禦" : "DEF"} +{display.equipStats.def}</span> : null}
                              </div>
                            )}
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>

          {/* Right: Detail panel */}
          <div className="md:w-80 lg:w-96 shrink-0">
            <div
              className="rounded-xl p-5 md:sticky md:top-16"
              style={{ background: "rgba(25,30,35,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {selectedInv && selectedDef ? (
                <div className="space-y-4">
                  {/* Item header: image left, info right */}
                  <div
                    className="flex gap-3 rounded-lg p-3"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-16 h-16 flex items-center justify-center">
                        {selectedDef.image ? (
                          <img src={selectedDef.image} alt="" className="w-14 h-14 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                        ) : (
                          <span className={`text-4xl ${selectedDef.color}`}>{selectedDef.icon}</span>
                        )}
                      </div>
                      <span className="text-[10px] tabular-nums text-white bg-black/50 rounded px-1.5 mt-1">
                        {selectedInv.quantity.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-sm font-bold leading-tight">
                        {isZh ? selectedDef.nameZh : selectedDef.nameEn}
                      </p>
                      {selectedDef.equipSlot && (
                        <span className="inline-block text-[10px] text-spirit-gold/70 bg-spirit-gold/10 rounded px-1.5 py-0.5 mt-1">
                          {SLOT_NAMES[selectedDef.equipSlot] ?? selectedDef.equipSlot}
                        </span>
                      )}
                      {selectedDef.requirementZh && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {isZh ? selectedDef.requirementZh : selectedDef.requirementEn}
                        </p>
                      )}
                      {selectedDef.hintZh && (
                        <p className="text-[10px] text-jade mt-1 leading-snug">
                          {isZh ? selectedDef.hintZh : selectedDef.hintEn}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  {(selectedDef.healHp || selectedDef.equipStats) && (
                    <>
                      <Separator className="opacity-20" />
                      <div className="space-y-1.5">
                        {selectedDef.healHp && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{isZh ? "恢復氣血" : "Restore HP"}</span>
                            <span className="text-jade font-bold">+{selectedDef.healHp}</span>
                          </div>
                        )}
                        {selectedDef.equipStats?.hp && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{isZh ? "氣血" : "HP"}</span>
                            <span className="text-red-400 font-bold">+{selectedDef.equipStats.hp}</span>
                          </div>
                        )}
                        {selectedDef.equipStats?.atk && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{isZh ? "外功" : "ATK"}</span>
                            <span className="text-spirit-gold font-bold">+{selectedDef.equipStats.atk}</span>
                          </div>
                        )}
                        {selectedDef.equipStats?.def && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{isZh ? "防禦" : "DEF"}</span>
                            <span className="text-blue-300 font-bold">+{selectedDef.equipStats.def}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Sell section */}
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <p className="text-xs text-muted-foreground text-center">{isZh ? "販售" : "Sell"}</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
                        disabled={sellQty <= 1}
                        onClick={() => { const n = sellQty - 1; setSellQty(n); setSellQtyInput(String(n)); }}
                      >-</Button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={sellQtyInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          setSellQtyInput(raw);
                          if (raw !== "") {
                            setSellQty(Math.max(1, Math.min(parseInt(raw, 10), selectedInv.quantity)));
                          }
                        }}
                        onBlur={() => {
                          if (sellQtyInput === "" || parseInt(sellQtyInput, 10) < 1) {
                            setSellQty(1);
                            setSellQtyInput("1");
                          }
                        }}
                        className="w-14 h-7 text-sm tabular-nums text-center font-bold rounded-md outline-none focus:border-jade/50"
                        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}
                      />
                      <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
                        disabled={sellQty >= selectedInv.quantity}
                        onClick={() => { const n = sellQty + 1; setSellQty(n); setSellQtyInput(String(n)); }}
                      >+</Button>
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2"
                        onClick={() => { setSellQty(selectedInv.quantity); setSellQtyInput(String(selectedInv.quantity)); }}
                      >{isZh ? "全部" : "All"}</Button>
                    </div>
                    {/* Slider */}
                    <input
                      type="range"
                      min={1}
                      max={selectedInv.quantity}
                      value={sellQty}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); setSellQty(v); setSellQtyInput(String(v)); }}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
                      style={{ background: `linear-gradient(to right, #d97706 ${((sellQty - 1) / Math.max(selectedInv.quantity - 1, 1)) * 100}%, rgba(255,255,255,0.1) ${((sellQty - 1) / Math.max(selectedInv.quantity - 1, 1)) * 100}%)` }}
                    />
                    <div className="flex items-center justify-between text-xs rounded px-2 py-1.5" style={{ background: "rgba(180,160,60,0.12)", border: "1px solid rgba(180,160,60,0.2)" }}>
                      <span className="text-muted-foreground">{isZh ? "獲得銀兩" : "Silver earned"}</span>
                      <span className="font-heading font-bold text-spirit-gold">+{sellQty}</span>
                    </div>
                    <Button
                      className="w-full seal-glow font-heading text-xs h-8"
                      onClick={handleSell}
                      disabled={selling}
                    >
                      {selling ? (isZh ? "販售中..." : "Selling...") : (isZh ? "確認販售" : "Sell")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-3xl text-muted-foreground/20 mb-3">🎒</span>
                  <p className="text-xs text-muted-foreground/50">
                    {isZh ? "點擊物品查看詳情" : "Click an item for details"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
