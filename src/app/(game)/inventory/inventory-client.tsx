"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { InventoryItem } from "@/lib/types";
import { getItem, ITEMS } from "@/lib/items";
import { useI18n } from "@/lib/i18n";

type FilterTab = "all" | "spirit_stone" | "ore" | "consumable" | "book" | "other" | "equipment";

// Sort priority: spirit_stone=0, ore=1, consumable=2, book=3, other(junk)=4, equipment=5(always last)
const FILTER_SORT_ORDER: Record<FilterTab, number> = {
  all: -1, spirit_stone: 0, ore: 1, consumable: 2, book: 3, other: 4, equipment: 5,
};

function getFilterTab(itemType: string): FilterTab {
  const def = ITEMS[itemType];
  if (!def) return "other";
  if (def.tags.includes("equipment")) return "equipment";
  if (def.tags.includes("spirit_stone")) return "spirit_stone";
  if (def.tags.includes("consumable")) return "consumable";
  if (def.tags.includes("book") || def.tags.includes("tome")) return "book";
  if (def.tags.includes("junk")) return "other";
  if (itemType.endsWith("_ore") || itemType.endsWith("_bar") || ["coal"].includes(itemType)) return "ore";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"normal" | "sell" | "sacrifice">("normal");
  const [multiSelect, setMultiSelect] = useState<Record<string, number>>({}); // item_type → selected qty

  const slotsUsed = new Set(inventory.map((i) => i.item_type)).size;

  const filteredInventory = (filterTab === "all"
    ? inventory
    : inventory.filter((i) => getFilterTab(i.item_type) === filterTab)
  ).filter((i) => {
    if (!searchQuery) return true;
    const def = ITEMS[i.item_type];
    if (!def) return false;
    const q = searchQuery.toLowerCase();
    return def.nameZh.toLowerCase().includes(q) || def.nameEn.toLowerCase().includes(q);
  });

  const selectedInv = selectedItem ? inventory.find((i) => i.item_type === selectedItem) : null;
  const selectedDef = selectedItem ? getItem(selectedItem) : null;

  const handleSelectItem = (itemType: string) => {
    if (mode === "sell" || mode === "sacrifice") {
      // Multi-select: toggle item, default to full quantity
      setMultiSelect((prev) => {
        const next = { ...prev };
        if (next[itemType]) {
          delete next[itemType];
        } else {
          const item = inventory.find((i) => i.item_type === itemType);
          next[itemType] = item?.quantity ?? 1;
        }
        return next;
      });
      return;
    }
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
    { key: "spirit_stone", labelZh: "靈石", labelEn: "Spirit Stones" },
    { key: "ore", labelZh: "礦物", labelEn: "Ores" },
    { key: "consumable", labelZh: "補品", labelEn: "Supplies" },
    { key: "book", labelZh: "書籍", labelEn: "Books" },
    { key: "other", labelZh: "垃圾", labelEn: "Junk" },
    { key: "equipment", labelZh: "裝備", labelEn: "Equip" },
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
        {/* Header — unified style with other skill pages */}
        <header className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src="/images/nav-items/nav-inventory.png" alt="" className="h-12 w-12 object-contain" />
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  {isZh ? "儲物袋" : "Inventory"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isZh ? `空間 ${slotsUsed} / ${totalSlots}` : `Space ${slotsUsed} / ${totalSlots}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{isZh ? "銀兩" : "Silver"}</p>
              <p className="font-heading text-lg text-spirit-gold tabular-nums">{daoPoints.toLocaleString()}</p>
            </div>
          </div>
          <div className="relative mt-4">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent" />
          </div>
        </header>

        {/* Toolbar: mode buttons (left) + search (right) */}
        <div
          className="flex items-center gap-2 mb-3 rounded-lg px-3 py-2"
          style={{ background: "rgba(25,30,35,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Mode buttons — left */}
          <div className="flex gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const sorted = [...inventory].sort((a, b) => {
                  const tabA = getFilterTab(a.item_type);
                  const tabB = getFilterTab(b.item_type);
                  const orderA = FILTER_SORT_ORDER[tabA] ?? 99;
                  const orderB = FILTER_SORT_ORDER[tabB] ?? 99;
                  if (orderA !== orderB) return orderA - orderB;
                  return a.item_type.localeCompare(b.item_type);
                });
                setInventory(sorted);
              }}
              className="text-xs border-border/40 hover:border-jade/40 hover:bg-jade/10 text-muted-foreground hover:text-jade"
            >
              {isZh ? "整理" : "Sort"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMode(mode === "sell" ? "normal" : "sell"); setMultiSelect({}); setSelectedItem(null); }}
              className={`text-xs ${
                mode === "sell"
                  ? "border-spirit-gold/50 bg-spirit-gold/10 text-spirit-gold"
                  : "border-border/40 hover:border-spirit-gold/40 hover:bg-spirit-gold/10 text-muted-foreground hover:text-spirit-gold"
              }`}
            >
              {isZh ? "販賣模式" : "Sell Mode"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMode(mode === "sacrifice" ? "normal" : "sacrifice"); setMultiSelect({}); setSelectedItem(null); }}
              className={`text-xs ${
                mode === "sacrifice"
                  ? "border-cinnabar/50 bg-cinnabar-dim/30 text-cinnabar"
                  : "border-border/40 hover:border-cinnabar/40 hover:bg-cinnabar-dim/20 text-muted-foreground hover:text-cinnabar"
              }`}
            >
              {isZh ? "獻祭模式" : "Sacrifice Mode"}
            </Button>
          </div>
          {/* Search — right */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? "🔍 搜尋物品..." : "🔍 Search..."}
              className="w-full bg-transparent text-sm text-foreground text-right placeholder:text-muted-foreground/50 outline-none"
            />
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
                  const isMultiSelected = (mode === "sell" || mode === "sacrifice") && !!multiSelect[item.item_type];
                  const isSelected = mode === "normal" ? selectedItem === item.item_type : isMultiSelected;
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
                          <div className="border-t border-border/30 px-3 py-2 space-y-0.5">
                            {display?.healHp && (
                              <p className="text-[11px] text-spirit-gold">{isZh ? `恢復 ${display.healHp} 氣血` : `Restore ${display.healHp} HP`}</p>
                            )}
                            {display?.equipStats?.hp && (
                              <p className="text-[11px] text-spirit-gold">{isZh ? `增加 ${display.equipStats.hp} 氣血` : `+${display.equipStats.hp} HP`}</p>
                            )}
                            {display?.equipStats?.atk && (
                              <p className="text-[11px] text-spirit-gold">{isZh ? `增加 ${display.equipStats.atk} 外功` : `+${display.equipStats.atk} ATK`}</p>
                            )}
                            {display?.equipStats?.def && (
                              <p className="text-[11px] text-spirit-gold">{isZh ? `增加 ${display.equipStats.def} 防禦` : `+${display.equipStats.def} DEF`}</p>
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
              {/* === SELL / SACRIFICE MODE === */}
              {(mode === "sell" || mode === "sacrifice") ? (() => {
                const selectedEntries = Object.entries(multiSelect);
                const totalQty = selectedEntries.reduce((sum, [, qty]) => sum + qty, 0);
                const totalSilver = totalQty; // 1:1 ratio for now

                const handleBatchAction = async () => {
                  if (totalQty <= 0) return;
                  setSelling(true);
                  try {
                    let latestDaoPoints = daoPoints;
                    for (const [itemType, qty] of selectedEntries) {
                      if (qty <= 0) continue;
                      const res = await fetch("/api/game/sacrifice", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ item_type: itemType, quantity: qty }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        latestDaoPoints = data.dao_points_total;
                      }
                    }
                    setDaoPoints(latestDaoPoints);
                    setInventory((prev) =>
                      prev
                        .map((i) => multiSelect[i.item_type] ? { ...i, quantity: i.quantity - multiSelect[i.item_type] } : i)
                        .filter((i) => i.quantity > 0)
                    );
                    setMultiSelect({});
                    router.refresh();
                  } catch {
                    // ignore
                  } finally {
                    setSelling(false);
                  }
                };

                return (
                  <div className="space-y-4">
                    {/* Mode title */}
                    <div className="text-center">
                      <p className={`font-heading text-base font-bold ${mode === "sell" ? "text-spirit-gold" : "text-cinnabar"}`}>
                        {mode === "sell"
                          ? (isZh ? "販賣模式" : "Sell Mode")
                          : (isZh ? "獻祭模式" : "Sacrifice Mode")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isZh ? "點擊左側物品選取/取消" : "Click items on the left to select/deselect"}
                      </p>
                    </div>

                    {/* Selected items list */}
                    {selectedEntries.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                        {selectedEntries.map(([itemType, qty]) => {
                          const def = getItem(itemType);
                          if (!def) return null;
                          return (
                            <button
                              key={itemType}
                              onClick={() => setMultiSelect((prev) => { const next = { ...prev }; delete next[itemType]; return next; })}
                              className="relative aspect-square rounded-md cursor-pointer hover:brightness-125 transition-all"
                              style={{
                                background: "rgba(0,0,0,0.35)",
                                border: mode === "sell" ? "1px solid rgba(180,160,60,0.4)" : "1px solid rgba(180,60,60,0.4)",
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center p-1">
                                {def.image ? (
                                  <img src={def.image} alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]" />
                                ) : (
                                  <span className={`text-lg ${def.color}`}>{def.icon}</span>
                                )}
                              </div>
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-white bg-black/60 rounded px-1 leading-tight">
                                {qty}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-xs text-muted-foreground/50">
                          {isZh ? "尚未選擇任何物品" : "No items selected"}
                        </p>
                      </div>
                    )}

                    {/* Total */}
                    {selectedEntries.length > 0 && (
                      <>
                        <div
                          className="flex items-center justify-between text-sm rounded-lg px-3 py-2"
                          style={{
                            background: mode === "sell" ? "rgba(180,160,60,0.12)" : "rgba(180,60,60,0.12)",
                            border: mode === "sell" ? "1px solid rgba(180,160,60,0.2)" : "1px solid rgba(180,60,60,0.2)",
                          }}
                        >
                          <span className="text-muted-foreground">
                            {mode === "sell" ? (isZh ? "獲得銀兩" : "Silver earned") : (isZh ? "獲得天道值" : "TAO Points")}
                          </span>
                          <span className={`font-heading font-bold tabular-nums ${mode === "sell" ? "text-spirit-gold" : "text-cinnabar"}`}>
                            +{totalSilver.toLocaleString()}
                          </span>
                        </div>

                        <Button
                          className={`w-full font-heading text-sm h-10 ${mode === "sell" ? "seal-glow" : "bg-cinnabar hover:bg-cinnabar/90 text-white"}`}
                          onClick={handleBatchAction}
                          disabled={selling}
                        >
                          {selling
                            ? (isZh ? "處理中..." : "Processing...")
                            : mode === "sell"
                            ? (isZh ? `確認販售 (${selectedEntries.length} 種物品)` : `Confirm Sell (${selectedEntries.length} items)`)
                            : (isZh ? `確認獻祭 (${selectedEntries.length} 種物品)` : `Confirm Sacrifice (${selectedEntries.length} items)`)}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })()

              /* === NORMAL MODE === */
              : selectedInv && selectedDef ? (
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
                      {(selectedDef.healHp || selectedDef.equipStats) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]">
                          {selectedDef.healHp && (
                            <span className="text-spirit-gold">{isZh ? `恢復 ${selectedDef.healHp} 氣血` : `Restore ${selectedDef.healHp} HP`}</span>
                          )}
                          {selectedDef.equipStats?.hp && (
                            <span className="text-spirit-gold">{isZh ? `增加 ${selectedDef.equipStats.hp} 氣血` : `+${selectedDef.equipStats.hp} HP`}</span>
                          )}
                          {selectedDef.equipStats?.atk && (
                            <span className="text-spirit-gold">{isZh ? `增加 ${selectedDef.equipStats.atk} 外功` : `+${selectedDef.equipStats.atk} ATK`}</span>
                          )}
                          {selectedDef.equipStats?.def && (
                            <span className="text-spirit-gold">{isZh ? `增加 ${selectedDef.equipStats.def} 防禦` : `+${selectedDef.equipStats.def} DEF`}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sell section (normal mode, single item) */}
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

              /* === EMPTY STATE === */
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <img src="/images/nav-items/nav-inventory.png" alt="" className="w-12 h-12 object-contain opacity-20 mb-3" />
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
