"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useGameState } from "@/components/mining-provider";
import { useI18n } from "@/lib/i18n";
import { ITEMS, getItem, hasTag } from "@/lib/items";
import { miningXpForLevel } from "@/lib/types";
import {
  SMELTING_RECIPES,
  COPPER_FORGING,
  FORGING_RECIPES,
  MATERIAL_TIERS,
  FUELS,
  MAX_HEAT,
  ENHANCEMENT_TABLE,
  SLOT_DISPLAY,
  getEquipmentBarType,
  type SmeltingRecipe,
  type ForgingRecipe,
  type EnhancementLevel,
} from "@/lib/smithing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemName(itemType: string, locale: string): string {
  const info = ITEMS[itemType];
  if (!info) return itemType;
  return locale === "en" ? info.nameEn : info.nameZh;
}

function getItemIcon(itemType: string): string {
  return ITEMS[itemType]?.icon ?? "○";
}

function getItemColor(itemType: string): string {
  return ITEMS[itemType]?.color ?? "text-foreground";
}

function getInvQty(inventory: { item_type: string; quantity: number }[], itemType: string): number {
  return inventory.find((i) => i.item_type === itemType)?.quantity ?? 0;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type SmithingTab = "craft" | "enhancement";
type EnhancePhase = "idle" | "enhancing" | "result";

// Unified recipe type for the craft tab
type CraftRecipe = (SmeltingRecipe | ForgingRecipe) & { _kind: "smelt" | "forge" };

function isForging(r: CraftRecipe): r is ForgingRecipe & { _kind: "forge" } {
  return r._kind === "forge";
}

// Recipe group for collapsible sections
interface RecipeGroup {
  id: string;
  nameZh: string;
  nameEn: string;
  minLevel: number;
  recipes: CraftRecipe[];
}

// ---------------------------------------------------------------------------
// Build recipe groups
// ---------------------------------------------------------------------------

function buildRecipeGroups(): RecipeGroup[] {
  const groups: RecipeGroup[] = [];

  // Smelting group
  groups.push({
    id: "smelting",
    nameZh: "煉錠",
    nameEn: "Smelting",
    minLevel: 1,
    recipes: SMELTING_RECIPES.map((r) => ({ ...r, _kind: "smelt" as const })),
  });

  // Forging groups per tier
  for (const tier of MATERIAL_TIERS) {
    const recipes = FORGING_RECIPES[tier.key] ?? [];
    groups.push({
      id: `forging_${tier.key}`,
      nameZh: tier.nameZh,
      nameEn: tier.nameEn,
      minLevel: tier.minLevel,
      recipes: recipes.map((r) => ({ ...r, _kind: "forge" as const })),
    });
  }

  return groups;
}

const RECIPE_GROUPS = buildRecipeGroups();

// ---------------------------------------------------------------------------
// XP Bar
// ---------------------------------------------------------------------------

function XpBar({ xp, xpMax, label }: { xp: number; xpMax: number; label: string }) {
  const pct = xpMax > 0 ? Math.min((xp / xpMax) * 100, 100) : 0;
  return (
    <div
      className="relative h-7 w-full overflow-hidden rounded-full"
      style={{
        background: "rgb(10,10,10)",
        boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(pct, 2)}%`,
          background: "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
          boxShadow: "0 0 8px rgba(62,207,165,0.5), 0 0 20px rgba(62,207,165,0.15)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)" }}
        />
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center gap-2 text-sm tabular-nums"
        style={{ textShadow: "0 0 1px #000, 0 0 4px #000, 0 1px 6px rgba(0,0,0,0.9)", color: "#fff" }}
      >
        <span
          className="font-heading font-bold"
          style={{ color: "#fbbf24", textShadow: "0 0 1px #000, 0 0 4px #000, 0 0 10px rgba(212,166,67,0.4), 0 1px 6px rgba(0,0,0,0.9)" }}
        >
          {label}
        </span>
        <span className="font-bold">{xp.toLocaleString()} / {xpMax.toLocaleString()}</span>
        <span className="font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>({pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heat Bar
// ---------------------------------------------------------------------------

function HeatBar({ heat, max }: { heat: number; max: number }) {
  const pct = max > 0 ? Math.min((heat / max) * 100, 100) : 0;
  return (
    <div className="w-full">
      <div
        className="relative h-5 w-full overflow-hidden rounded-full"
        style={{
          background: "rgb(15,10,10)",
          boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,100,0,0.15)",
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(pct, 1)}%`,
            background: "linear-gradient(90deg, #7f1d1d, #dc2626, #f97316)",
            boxShadow: "0 0 8px rgba(249,115,22,0.5), 0 0 16px rgba(249,115,22,0.2)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)" }}
          />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs tabular-nums font-bold"
          style={{ textShadow: "0 0 2px #000, 0 0 6px #000", color: "#fff" }}
        >
          <span>🔥</span>
          <span>{heat} / {max}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crafting Progress Bar
// ---------------------------------------------------------------------------

function CraftingProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="relative h-4 w-full overflow-hidden rounded-full"
      style={{
        background: "rgb(10,10,10)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, #1a4a3a, #3ecfa5, #6ee7b7)",
          boxShadow: "0 0 6px rgba(62,207,165,0.4)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Furnace Visual
// ---------------------------------------------------------------------------

function FurnaceVisual({ active, overlay, overlayLevel }: { active: boolean; overlay?: string; overlayLevel?: number }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`w-24 h-24 rounded-xl flex items-center justify-center select-none transition-all duration-300 ${active ? "animate-pulse" : "opacity-40"}`}
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,120,30,0.15)",
          boxShadow: active
            ? "0 0 20px rgba(249,115,22,0.4), 0 0 40px rgba(220,38,38,0.15), inset 0 0 15px rgba(249,115,22,0.15)"
            : "inset 0 0 8px rgba(0,0,0,0.3)",
          animation: active ? "furnace-shake 0.3s ease-in-out infinite" : "none",
        }}
      >
        <div className="relative">
          <span className="text-5xl" style={{ filter: active ? "drop-shadow(0 0 12px rgba(249,115,22,0.6))" : "none" }}>🔥</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fuel Panel (bottom, shared)
// ---------------------------------------------------------------------------

function FuelPanel({
  heat,
  inventory,
  locale,
  onAddFuel,
}: {
  heat: number;
  inventory: { item_type: string; quantity: number }[];
  locale: string;
  onAddFuel: (fuelItem: string, heat: number, quantity: number) => void;
}) {
  const isZh = locale === "zh";
  const [pickedFuel, setPickedFuel] = useState<string | null>(null);
  const [showFuelPicker, setShowFuelPicker] = useState(false);
  const [fuelQty, setFuelQty] = useState(1);
  const [fuelQtyInput, setFuelQtyInput] = useState("1");

  // All fuel items the player owns
  const fuelItems = inventory.filter((i) => {
    const def = ITEMS[i.item_type];
    return def?.tags.includes("fuel") && i.quantity > 0;
  });

  const pickedDef = pickedFuel ? getItem(pickedFuel) : null;
  const pickedInv = pickedFuel ? fuelItems.find((i) => i.item_type === pickedFuel) : null;
  const pickedFuelData = pickedFuel ? FUELS.find((f) => f.item === pickedFuel) : null;

  const handlePickFuel = (itemType: string) => {
    const next = itemType === pickedFuel ? null : itemType;
    setPickedFuel(next);
    setFuelQty(1);
    setFuelQtyInput("1");
  };

  // Max fuel addable = min(owned, floor(remaining heat capacity / heat per unit))
  const remainingHeat = MAX_HEAT - heat;
  const maxFuelAdd = pickedFuel && pickedInv && pickedFuelData
    ? Math.min(pickedInv.quantity, Math.max(0, Math.floor(remainingHeat / pickedFuelData.heat)))
    : 0;
  const fuelFull = remainingHeat <= 0 || maxFuelAdd <= 0;

  const handleAddFuel = () => {
    if (!pickedFuel || !pickedFuelData || fuelQty <= 0) return;
    onAddFuel(pickedFuel, pickedFuelData.heat, fuelQty);
    // pickedFuel stays selected — only clear if quantity reaches 0 (handled by parent via inventory update)
  };

  return (
    <div className="space-y-3">
      {/* Heat bar */}
      <HeatBar heat={heat} max={MAX_HEAT} />

      {/* Fuel: single slot + details */}
      <div className="mt-3 flex gap-3 items-center">
        {/* Single fuel slot */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowFuelPicker(!showFuelPicker)}
            className={`relative w-16 h-16 rounded-md transition-all cursor-pointer ${
              pickedFuel ? "ring-2 ring-orange-500 shadow-[0_0_6px_rgba(255,120,30,0.3)]" : "hover:brightness-125"
            }`}
            style={{
              background: "rgba(0,0,0,0.4)",
              border: pickedFuel ? "1px solid rgba(255,120,30,0.6)" : "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {pickedDef ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  {pickedDef.image ? (
                    <img src={pickedDef.image} alt="" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className={`text-xl ${pickedDef.color}`}>{pickedDef.icon}</span>
                  )}
                </div>
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-white bg-black/60 rounded px-1 leading-tight">
                  {pickedInv?.quantity ?? 0}
                </span>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 text-xl">+</div>
            )}
          </button>

          {/* Fuel picker dropdown */}
          {showFuelPicker && (
            <div
              className="absolute top-full left-0 mt-1 z-30 rounded-lg p-2 grid grid-cols-3 gap-1.5 min-w-[10rem]"
              style={{ background: "rgb(20,15,15)", border: "1px solid rgba(255,100,0,0.2)", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
            >
              <TooltipProvider>
              {fuelItems.map((item) => {
                const def = getItem(item.item_type);
                const fuelData = FUELS.find((f) => f.item === item.item_type);
                return (
                  <Tooltip key={item.item_type}>
                    <TooltipTrigger
                      onClick={() => { handlePickFuel(item.item_type); setShowFuelPicker(false); }}
                      className="relative w-12 h-12 rounded-md cursor-pointer hover:brightness-125"
                      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,100,0,0.12)" }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {def?.image ? (
                          <img src={def.image} alt="" className="w-7 h-7 object-contain" />
                        ) : (
                          <span className={`text-sm ${def?.color ?? ""}`}>{def?.icon ?? "?"}</span>
                        )}
                        <span className="text-[7px] text-orange-400/70">+{fuelData?.heat ?? 0}</span>
                      </div>
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] tabular-nums text-white bg-black/60 rounded px-0.5">
                        {item.quantity}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="p-2 min-w-[140px]">
                      <p className="font-heading text-sm">{def ? (isZh ? def.nameZh : def.nameEn) : item.item_type}</p>
                      {def?.hintZh && <p className="text-[10px] text-jade mt-0.5">{isZh ? def.hintZh : def.hintEn}</p>}
                      <p className="text-[10px] text-orange-400 mt-1">🔥 +{fuelData?.heat ?? 0} {isZh ? "熱值" : "Heat"}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              </TooltipProvider>
              {fuelItems.length === 0 && (
                <p className="col-span-3 text-center text-[10px] text-muted-foreground/40 py-2">{isZh ? "無燃料" : "No fuel"}</p>
              )}
            </div>
          )}
        </div>

        {/* Middle: name + slider */}
        <div className="flex-1 min-w-0 flex flex-col justify-center h-16">
          {pickedFuel && pickedInv && pickedFuelData ? (
            <>
              <div className="flex items-baseline justify-between gap-1 mb-1">
                <span className="text-sm font-heading font-bold truncate text-white">{isZh ? pickedDef?.nameZh : pickedDef?.nameEn}</span>
                <span className="text-xs text-orange-400 shrink-0 tabular-nums">+{pickedFuelData.heat}/{isZh ? "個" : "ea"}</span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, maxFuelAdd)}
                value={Math.min(fuelQty, Math.max(1, maxFuelAdd))}
                disabled={fuelFull}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setFuelQty(v); setFuelQtyInput(String(v)); }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-orange-500 mb-1 disabled:opacity-30"
                style={{ background: `linear-gradient(to right, #c2410c ${((Math.min(fuelQty, maxFuelAdd) - 1) / Math.max(maxFuelAdd - 1, 1)) * 100}%, rgba(255,255,255,0.1) ${((Math.min(fuelQty, maxFuelAdd) - 1) / Math.max(maxFuelAdd - 1, 1)) * 100}%)` }}
              />
              <p className="text-xs tabular-nums text-orange-400">
                {fuelQty}× → <span className="font-bold">+{pickedFuelData.heat * fuelQty}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/40">{isZh ? "← 選擇燃料" : "← Select fuel"}</p>
          )}
        </div>

        {/* Right: add button (same size as fuel slot) */}
        <button
          onClick={pickedFuel && !fuelFull ? handleAddFuel : undefined}
          disabled={!pickedFuel || fuelFull}
          className={`w-16 h-16 rounded-md shrink-0 flex flex-col items-center justify-center font-heading text-sm font-bold transition-all ${
            pickedFuel && !fuelFull
              ? "bg-orange-700 hover:bg-orange-600 text-white cursor-pointer shadow-[0_0_8px_rgba(249,115,22,0.3)]"
              : "opacity-30 cursor-not-allowed text-muted-foreground"
          }`}
          style={{
            border: pickedFuel && !fuelFull ? "1px solid rgba(255,120,30,0.4)" : "1px solid rgba(255,255,255,0.1)",
            background: pickedFuel && !fuelFull ? undefined : "rgba(0,0,0,0.4)",
          }}
        >
          {fuelFull && pickedFuel ? (isZh ? "已滿" : "Full") : (isZh ? "添加" : "Add")}
        </button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SmithingPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const gameState = useGameState();
  const { inventory } = gameState;

  // Dummy smithing stats
  const smithingLevel = 1;
  const smithingXp = 0;
  const smithingXpMax = miningXpForLevel(1);

  // Tab state: 2 tabs now
  const [activeTab, setActiveTab] = useState<SmithingTab>("craft");

  // Shared furnace state — persisted via DB
  const heat = gameState.furnaceHeat;
  const [autoRefuel, setAutoRefuel] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<string>(FUELS[0].item);

  // Craft tab state
  const [selectedRecipe, setSelectedRecipe] = useState<CraftRecipe | null>(null);
  const [craftActive, setCraftActive] = useState(false);
  const [craftProgress, setCraftProgress] = useState(0);
  const [craftCount, setCraftCount] = useState(0);
  const [craftQty, setCraftQty] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Unlocked groups default expanded, locked collapsed
    const init: Record<string, boolean> = {};
    for (const g of RECIPE_GROUPS) {
      init[g.id] = 1 >= g.minLevel; // smithingLevel = 1
    }
    return init;
  });

  // Enhancement state
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [enhancePhase, setEnhancePhase] = useState<EnhancePhase>("idle");
  const [enhanceResult, setEnhanceResult] = useState<"success" | "fail" | "break" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [equipEnhanceLevels, setEquipEnhanceLevels] = useState<Record<string, number>>({});

  // Default selected recipe
  useEffect(() => {
    if (!selectedRecipe && RECIPE_GROUPS.length > 0) {
      const first = RECIPE_GROUPS[0];
      if (first.recipes.length > 0 && smithingLevel >= first.minLevel) {
        setSelectedRecipe(first.recipes[0]);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute max craftable quantity
  const maxCraftQty = useMemo(() => {
    if (!selectedRecipe) return 0;
    let maxByMat = Infinity;
    for (const mat of selectedRecipe.materials) {
      const owned = getInvQty(inventory, mat.item);
      maxByMat = Math.min(maxByMat, Math.floor(owned / mat.qty));
    }
    const maxByHeat = selectedRecipe.heat > 0 ? Math.floor(heat / selectedRecipe.heat) : Infinity;
    const result = Math.min(maxByMat, maxByHeat);
    return result === Infinity ? 0 : result;
  }, [selectedRecipe, inventory, heat]);

  // Crafting tick simulation
  const craftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (craftActive && selectedRecipe) {
      const tickMs = 100;
      const totalTicks = (selectedRecipe.time * 1000) / tickMs;
      let tick = 0;
      craftTimerRef.current = setInterval(() => {
        tick++;
        setCraftProgress((tick / totalTicks) * 100);
        if (tick >= totalTicks) {
          setCraftCount((c) => c + 1);
          tick = 0;
          setCraftProgress(0);
        }
      }, tickMs);
      return () => { if (craftTimerRef.current) clearInterval(craftTimerRef.current); };
    } else {
      setCraftProgress(0);
    }
  }, [craftActive, selectedRecipe]);

  // Enhancement animation
  const enhanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEnhance = useCallback(() => {
    if (!selectedEquipment) return;
    const currentLevel = equipEnhanceLevels[selectedEquipment] ?? 0;
    const targetLevel = currentLevel + 1;

    if (targetLevel >= 11 && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }
    setShowConfirmDialog(false);

    const enhInfo = ENHANCEMENT_TABLE.find((e) => e.level === targetLevel);
    if (!enhInfo) return;

    setEnhancePhase("enhancing");
    enhanceTimerRef.current = setTimeout(() => {
      const roll = Math.random() * 100;
      if (roll < enhInfo.rate) {
        setEnhanceResult("success");
        setEquipEnhanceLevels((prev) => ({ ...prev, [selectedEquipment]: targetLevel }));
      } else if (enhInfo.failResult === "downgrade_break" && enhInfo.breakChance && Math.random() * 100 < enhInfo.breakChance) {
        setEnhanceResult("break");
        setEquipEnhanceLevels((prev) => ({ ...prev, [selectedEquipment]: 0 }));
      } else if (enhInfo.failResult === "downgrade" || enhInfo.failResult === "downgrade_break") {
        setEnhanceResult("fail");
        setEquipEnhanceLevels((prev) => ({ ...prev, [selectedEquipment]: Math.max(0, currentLevel - 1) }));
      } else {
        setEnhanceResult("fail");
      }
      setEnhancePhase("result");
      setTimeout(() => {
        setEnhancePhase("idle");
        setEnhanceResult(null);
      }, 2000);
    }, 1500);
  }, [selectedEquipment, equipEnhanceLevels, showConfirmDialog]);

  useEffect(() => {
    return () => { if (enhanceTimerRef.current) clearTimeout(enhanceTimerRef.current); };
  }, []);

  // Add fuel handler — persists to DB
  const handleAddFuel = useCallback(async (fuelItem: string, _heatPerUnit: number, quantity: number) => {
    // Optimistic: compute expected result
    const fuelDef = FUELS.find((f) => f.item === fuelItem);
    if (!fuelDef) return;
    const optimisticAdd = Math.min(quantity * fuelDef.heat, MAX_HEAT - heat);
    const optimisticQty = Math.ceil(optimisticAdd / fuelDef.heat);
    // Optimistic UI update
    gameState.setFurnaceHeat(Math.min(heat + optimisticQty * fuelDef.heat, MAX_HEAT));
    gameState.updateInventory((prev) =>
      prev.map((item) =>
        item.item_type === fuelItem
          ? { ...item, quantity: item.quantity - optimisticQty }
          : item
      ).filter((item) => item.quantity > 0)
    );
    setSelectedFuel(fuelItem);

    const res = await fetch("/api/game/smithing/add-fuel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fuel_item: fuelItem, quantity }),
    });
    if (!res.ok) {
      // Revert optimistic on failure
      gameState.setFurnaceHeat(heat);
      gameState.updateInventory((prev) => {
        const existing = prev.find((i) => i.item_type === fuelItem);
        if (existing) {
          return prev.map((i) => i.item_type === fuelItem ? { ...i, quantity: i.quantity + optimisticQty } : i);
        }
        return [...prev, { item_type: fuelItem, quantity: optimisticQty } as typeof prev[number]];
      });
      return;
    }
    const data = await res.json();
    // Reconcile with server truth
    gameState.setFurnaceHeat(data.heat);
  }, [gameState, heat]);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // Equipment from inventory
  const equipmentItems = inventory.filter((i) => hasTag(i.item_type, "equipment"));

  // Filter recipe groups by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return RECIPE_GROUPS;
    const q = searchQuery.toLowerCase();
    return RECIPE_GROUPS.map((g) => ({
      ...g,
      recipes: g.recipes.filter(
        (r) => r.nameZh.toLowerCase().includes(q) || r.nameEn.toLowerCase().includes(q)
      ),
    })).filter((g) => g.recipes.length > 0);
  }, [searchQuery]);

  // Failure consequence text for enhancement
  const getFailText = (info: EnhancementLevel | null): { text: string; color: string } => {
    if (!info) return { text: "", color: "" };
    switch (info.failResult) {
      case "consume": return {
        text: isZh ? "失敗: 消耗材料" : "Fail: materials consumed",
        color: "text-yellow-500",
      };
      case "downgrade": return {
        text: isZh ? "失敗: 降一級" : "Fail: downgrade -1",
        color: "text-orange-400",
      };
      case "downgrade_break": return {
        text: isZh ? `失敗: 降一級 (${info.breakChance}% 機率碎裂)` : `Fail: downgrade -1 (${info.breakChance}% break chance)`,
        color: "text-red-400",
      };
      default: return { text: "", color: "" };
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* === Header Bar === */}
        <header className="mb-6 -mx-6 md:-mx-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src="/images/nav-items/nav-smithing.png" alt="" className="h-12 w-12 object-contain" />
                <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  {isZh ? "煉器" : "Smithing"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isZh ? "以爐火煉器，鑄就仙兵利器" : "Forge divine weapons in the celestial furnace"}
              </p>
            </div>
            <Badge variant="outline" className="border-jade/40 bg-jade text-white font-heading px-3 py-1.5 text-sm">
              {isZh ? "煉器等級" : "Smithing Lv."} {smithingLevel}
            </Badge>
          </div>
        </header>

        {/* Skill XP bar */}
        <div className="mb-6 -mx-6 md:-mx-12">
          <XpBar xp={smithingXp} xpMax={smithingXpMax} label={isZh ? "煉器經驗" : "Smithing XP"} />
        </div>


        {/* ================================================================ */}
        {/* TAB 1: CRAFT (merged smelting + forging) */}
        {/* ================================================================ */}
        {activeTab === "craft" && (
          <>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left: collapsible recipe list */}
              <div
                className="w-full md:w-[280px] shrink-0 rounded-xl border overflow-hidden flex flex-col"
                style={{
                  background: "linear-gradient(180deg, rgb(35,25,25) 0%, rgb(22,15,15) 100%)",
                  border: "1px solid rgba(255,100,0,0.12)",
                  maxHeight: "600px",
                }}
              >
                {/* Tab buttons + Search */}
                <div className="p-3 border-b space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex gap-1">
                    {([
                      { key: "craft" as SmithingTab, zh: "製作", en: "Craft" },
                      { key: "enhancement" as SmithingTab, zh: "強化", en: "Enhance" },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-1.5 rounded-md text-sm font-heading font-bold transition-colors ${
                          activeTab === tab.key
                            ? "bg-orange-800/60 text-orange-200 border border-orange-600/30"
                            : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {isZh ? tab.zh : tab.en}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isZh ? "搜尋配方..." : "Search recipes..."}
                    className="w-full bg-black/40 border rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-orange-500/50"
                    style={{ borderColor: "rgba(255,100,0,0.15)" }}
                  />
                </div>

                {/* Recipe groups */}
                <div className="flex-1 overflow-y-auto">
                  {filteredGroups.map((group) => {
                    const locked = smithingLevel < group.minLevel;
                    const expanded = expandedGroups[group.id] ?? !locked;

                    return (
                      <div key={group.id}>
                        {/* Group header */}
                        <button
                          onClick={() => !locked && toggleGroup(group.id)}
                          disabled={locked}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all ${
                            locked
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-card/40 cursor-pointer"
                          }`}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <span className="text-xs text-muted-foreground">
                            {locked ? "▶" : expanded ? "▼" : "▶"}
                          </span>
                          <span className="font-heading text-sm flex-1">
                            {isZh ? group.nameZh : group.nameEn}
                          </span>
                          {locked && (
                            <span className="text-xs text-muted-foreground">
                              🔒 Lv.{group.minLevel}
                            </span>
                          )}
                        </button>

                        {/* Recipes in group */}
                        {expanded && !locked && (
                          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                            {group.recipes.map((recipe) => {
                              const recipeLocked = smithingLevel < recipe.level;
                              const isSelected = selectedRecipe?.id === recipe.id;
                              const outputItem = getItem(recipe.output);

                              return (
                                <button
                                  key={recipe.id}
                                  onClick={() => {
                                    if (!recipeLocked) {
                                      setSelectedRecipe(recipe);
                                      setCraftActive(false);
                                      setCraftCount(0);
                                      setCraftProgress(0);
                                      setCraftQty(1);
                                    }
                                  }}
                                  disabled={recipeLocked}
                                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${
                                    recipeLocked
                                      ? "opacity-40 cursor-not-allowed"
                                      : isSelected
                                      ? "bg-jade/10"
                                      : "hover:bg-card/60"
                                  }`}
                                  style={{
                                    borderLeft: isSelected ? "3px solid var(--jade, #3ecfa5)" : "3px solid transparent",
                                  }}
                                >
                                  <span className={`text-lg ${outputItem?.color ?? "text-foreground"}`}>
                                    {outputItem?.icon ?? "○"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-heading text-sm truncate">
                                      {recipeLocked ? "???" : isZh ? recipe.nameZh : recipe.nameEn}
                                      {recipeLocked && <span className="ml-1">🔒</span>}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground tabular-nums">
                                      {isZh ? `等級 ${recipe.level}` : `Lv.${recipe.level}`}
                                      {isForging(recipe) && (
                                        <>
                                          {" · "}
                                          {isZh
                                            ? (SLOT_DISPLAY[recipe.slot]?.zh ?? recipe.slot)
                                            : (SLOT_DISPLAY[recipe.slot]?.en ?? recipe.slot)}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right side: two stacked cards */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Upper card: Furnace (left) + Fuel (right) */}
                <div
                  className="rounded-xl border p-4 flex gap-4 items-center"
                  style={{
                    background: "linear-gradient(180deg, rgb(22,18,18) 0%, rgb(15,12,12) 100%)",
                    border: "1px solid rgba(255,100,0,0.12)",
                  }}
                >
                  <div className="shrink-0">
                    <FurnaceVisual active={craftActive} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <FuelPanel
                      heat={heat}
                      inventory={inventory}
                      locale={locale}
                      onAddFuel={handleAddFuel}
                    />
                  </div>
                </div>

                {/* Lower card: Craft details */}
                <div
                  className="rounded-xl border p-4 sm:p-6"
                  style={{
                    background: "linear-gradient(180deg, rgb(35,25,25) 0%, rgb(22,15,15) 100%)",
                    border: "1px solid rgba(255,100,0,0.12)",
                  }}
                >
                {selectedRecipe ? (
                  <div className="flex flex-col gap-5">
                    {/* Top row: Product (left) + Materials (right) */}
                    <div className="flex gap-4 flex-col sm:flex-row">
                      {/* Left: Product preview */}
                      <div
                        className="sm:w-1/2 rounded-lg p-3 space-y-3"
                        style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {/* Top: stat badges (mining page style) */}
                        <div className="grid grid-cols-4 gap-1 rounded-lg p-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <TooltipProvider>
                          {([
                            { icon: "🔨", value: `+${selectedRecipe.xp}`, tip: isZh ? "鍛造經驗" : "Smithing XP", color: "text-orange-400" },
                            { icon: "🏆", value: `+${selectedRecipe.xp}`, tip: isZh ? "精練經驗" : "Mastery XP", color: "text-cinnabar" },
                            { icon: "💪", value: `+${Math.floor(selectedRecipe.xp * 0.5)}`, tip: isZh ? "煉體經驗" : "Body XP", color: "text-spirit-gold" },
                            { icon: "⏱", value: `${selectedRecipe.time}s`, tip: isZh ? "所需時間" : "Time", color: "text-white/60" },
                          ]).map((stat) => (
                            <Tooltip key={stat.tip}>
                              <TooltipTrigger className="flex flex-col items-center gap-0.5 py-1 cursor-default rounded w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <span className={`${stat.color} text-[11px]`}>{stat.icon}</span>
                                <span className="tabular-nums text-[10px] text-white/80">{stat.value}</span>
                              </TooltipTrigger>
                              <TooltipContent>{stat.tip}</TooltipContent>
                            </Tooltip>
                          ))}
                          </TooltipProvider>
                        </div>

                        {/* Middle: icon + name */}
                        <div className="flex gap-3 items-center">
                          <div
                            className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              background: "rgba(0,0,0,0.4)",
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          >
                            {(() => {
                              const outputItem = getItem(selectedRecipe.output);
                              return outputItem?.image ? (
                                <img src={outputItem.image} alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]" />
                              ) : (
                                <span className={`text-2xl ${outputItem?.color ?? "text-foreground"}`}>
                                  {outputItem?.icon ?? "○"}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-heading text-sm font-bold text-white truncate">
                              {isZh ? selectedRecipe.nameZh : selectedRecipe.nameEn}
                            </p>
                            {isForging(selectedRecipe) ? (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {isZh
                                  ? (SLOT_DISPLAY[selectedRecipe.slot]?.zh ?? selectedRecipe.slot)
                                  : (SLOT_DISPLAY[selectedRecipe.slot]?.en ?? selectedRecipe.slot)}
                              </p>
                            ) : (() => {
                              const outputDef = getItem(selectedRecipe.output);
                              return outputDef?.hintZh ? (
                                <p className="text-[10px] text-jade mt-0.5">{isZh ? outputDef.hintZh : outputDef.hintEn}</p>
                              ) : null;
                            })()}
                          </div>
                        </div>

                        {/* Bottom: equipment stats */}
                        {isForging(selectedRecipe) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                            {selectedRecipe.stats.atk != null && selectedRecipe.stats.atk > 0 && (
                              <span className="text-spirit-gold font-bold">{isZh ? "外功" : "ATK"} +{selectedRecipe.stats.atk}</span>
                            )}
                            {selectedRecipe.stats.def != null && selectedRecipe.stats.def > 0 && (
                              <span className="text-blue-300 font-bold">{isZh ? "防禦" : "DEF"} +{selectedRecipe.stats.def}</span>
                            )}
                            {selectedRecipe.stats.hp != null && selectedRecipe.stats.hp > 0 && (
                              <span className="text-red-400 font-bold">{isZh ? "氣血" : "HP"} +{selectedRecipe.stats.hp}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Materials */}
                      <div
                        className="sm:w-1/2 rounded-lg p-3 space-y-2"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                      <p className="text-xs text-muted-foreground font-heading">{isZh ? "所需材料" : "Materials"}</p>
                      {selectedRecipe.materials.map((mat) => {
                        const matItem = getItem(mat.item);
                        const owned = getInvQty(inventory, mat.item);
                        const enough = owned >= mat.qty * craftQty;
                        return (
                          <div key={mat.item} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 flex items-center justify-center shrink-0 rounded" style={!matItem?.image ? { background: "rgba(255,255,255,0.08)", border: "1px dashed rgba(255,255,255,0.2)" } : undefined}>
                                {matItem?.image ? (
                                  <img src={matItem.image} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <span className={`text-[10px] ${matItem?.color ?? "text-foreground"}`}>{matItem?.icon ?? "?"}</span>
                                )}
                              </div>
                              <span className="text-white/80">{isZh ? (matItem?.nameZh ?? mat.item) : (matItem?.nameEn ?? mat.item)}</span>
                              <span className="text-muted-foreground tabular-nums">×{mat.qty * craftQty}</span>
                            </div>
                            <span className={`text-xs tabular-nums font-bold ${enough ? "text-jade" : "text-red-400"}`}>
                              {owned}
                            </span>
                          </div>
                        );
                      })}
                      {/* Heat cost */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <span className="text-sm text-orange-400">🔥</span>
                          </div>
                          <span className="text-white/80">{isZh ? "熱值" : "Heat"}</span>
                          <span className="text-muted-foreground tabular-nums">×{selectedRecipe.heat * craftQty}</span>
                        </div>
                        <span className={`text-xs tabular-nums font-bold ${heat >= selectedRecipe.heat * craftQty ? "text-jade" : "text-red-400"}`}>
                          {heat}
                        </span>
                      </div>
                    </div>
                    </div>

                    {/* Craft quantity + max */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">{isZh ? "數量" : "Qty"}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-border/40 hover:border-jade/40 text-sm"
                        onClick={() => setCraftQty((q) => Math.max(1, q - 1))}
                        disabled={craftQty <= 1 || craftActive}
                      >-</Button>
                      <input
                        type="text" inputMode="numeric"
                        value={craftQty}
                        onChange={(e) => {
                          const v = parseInt(e.target.value.replace(/\D/g, "")) || 1;
                          setCraftQty(Math.max(1, Math.min(v, Math.max(1, maxCraftQty))));
                        }}
                        disabled={craftActive}
                        className="w-12 h-8 text-center rounded-md text-sm tabular-nums font-bold focus:outline-none focus:border-jade/50"
                        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <Button variant="outline" size="icon" className="h-8 w-8 border-border/40 hover:border-jade/40 text-sm"
                        onClick={() => setCraftQty((q) => Math.min(Math.max(1, maxCraftQty), q + 1))}
                        disabled={craftQty >= maxCraftQty || craftActive}
                      >+</Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs border-border/40 hover:border-jade/40 ml-auto"
                        onClick={() => setCraftQty(Math.max(1, maxCraftQty))}
                        disabled={craftActive}
                      >
                        {isZh ? "最大" : "Max"} {maxCraftQty}
                      </Button>
                    </div>

                    {/* Crafting progress */}
                    <CraftingProgressBar progress={craftProgress} />

                    {/* Completed counter */}
                    {craftCount > 0 && (
                      <p className="text-center text-sm font-heading text-jade tabular-nums">
                        {isZh ? selectedRecipe.nameZh : selectedRecipe.nameEn} ×{craftCount} {isZh ? "已完成" : "done"}
                      </p>
                    )}

                    {/* Start / Stop button */}
                    <Button
                      onClick={() => {
                        if (craftActive) {
                          setCraftActive(false);
                        } else {
                          setCraftCount(0);
                          setCraftActive(true);
                        }
                      }}
                      className={`w-full font-heading text-base h-11 ${
                        craftActive
                          ? "bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50"
                          : "seal-glow text-white"
                      }`}
                    >
                      {craftActive
                        ? (isZh ? "停止製作" : "Stop")
                        : (isZh ? "開始製作" : "Start Crafting")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
                    <span className="text-3xl mb-2">🔨</span>
                    <p className="text-sm">{isZh ? "選擇一個配方" : "Select a recipe"}</p>
                  </div>
                )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 2: ENHANCEMENT */}
        {/* ================================================================ */}
        {activeTab === "enhancement" && (() => {
          const selectedItemDef = selectedEquipment ? getItem(selectedEquipment) : null;
          const currentEnhLevel = selectedEquipment ? (equipEnhanceLevels[selectedEquipment] ?? 0) : 0;
          const targetLevel = currentEnhLevel + 1;
          const enhInfo = ENHANCEMENT_TABLE.find((e) => e.level === targetLevel) ?? null;
          const barType = selectedEquipment ? getEquipmentBarType(selectedEquipment) : null;
          const barOwned = barType ? getInvQty(inventory, barType) : 0;
          const barItem = barType ? getItem(barType) : null;

          const baseStats = selectedItemDef?.equipStats ?? {};
          const enhMultiplier = 1 + currentEnhLevel * 0.1;
          const nextMultiplier = 1 + targetLevel * 0.1;
          const currentStats = {
            hp: baseStats.hp ? Math.floor(baseStats.hp * enhMultiplier) : 0,
            atk: baseStats.atk ? Math.floor(baseStats.atk * enhMultiplier) : 0,
            def: baseStats.def ? Math.floor(baseStats.def * enhMultiplier) : 0,
          };
          const nextStats = {
            hp: baseStats.hp ? Math.floor(baseStats.hp * nextMultiplier) : 0,
            atk: baseStats.atk ? Math.floor(baseStats.atk * nextMultiplier) : 0,
            def: baseStats.def ? Math.floor(baseStats.def * nextMultiplier) : 0,
          };

          const failInfo = getFailText(enhInfo);

          return (
            <>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Left: Equipment Grid */}
                <div
                  className="w-full md:w-[280px] shrink-0 rounded-xl border overflow-hidden"
                  style={{
                    background: "linear-gradient(180deg, rgb(35,25,25) 0%, rgb(22,15,15) 100%)",
                    border: "1px solid rgba(255,100,0,0.12)",
                  }}
                >
                  <div className="p-3 border-b space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="flex gap-1">
                      {([
                        { key: "craft" as SmithingTab, zh: "製作", en: "Craft" },
                        { key: "enhancement" as SmithingTab, zh: "強化", en: "Enhance" },
                      ]).map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex-1 py-1.5 rounded-md text-sm font-heading font-bold transition-colors ${
                            activeTab === tab.key
                              ? "bg-orange-800/60 text-orange-200 border border-orange-600/30"
                              : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          {isZh ? tab.zh : tab.en}
                        </button>
                      ))}
                    </div>
                    <h3 className="font-heading text-xs text-muted-foreground">{isZh ? "選擇裝備" : "Select Equipment"}</h3>
                  </div>
                  <div className="p-3">
                    {equipmentItems.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {isZh ? "無可強化裝備" : "No equipment to enhance"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {equipmentItems.map((item) => {
                          const display = getItem(item.item_type);
                          const isSelected = selectedEquipment === item.item_type;
                          const enhLvl = equipEnhanceLevels[item.item_type] ?? 0;
                          return (
                            <button
                              key={item.item_type}
                              onClick={() => {
                                setSelectedEquipment(item.item_type);
                                setShowConfirmDialog(false);
                                setEnhancePhase("idle");
                                setEnhanceResult(null);
                              }}
                              className={`flex flex-col items-center justify-between rounded-lg border transition-all p-2 aspect-square cursor-pointer ${
                                isSelected
                                  ? "border-jade bg-jade/15 scale-105 shadow-md"
                                  : "border-border/50 bg-card/60 hover:border-jade/40 hover:bg-card"
                              }`}
                            >
                              <div className="flex-1 flex items-center justify-center relative">
                                {display?.image ? (
                                  <img src={display.image} alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]" />
                                ) : (
                                  <span className={`text-2xl ${display?.color ?? "text-foreground"}`}>
                                    {display?.icon ?? "○"}
                                  </span>
                                )}
                                {enhLvl > 0 && (
                                  <span className="absolute -top-1 -right-1 text-[10px] font-heading font-bold text-spirit-gold bg-black/60 rounded px-0.5">
                                    +{enhLvl}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] tabular-nums text-muted-foreground text-center w-full truncate">
                                x{item.quantity}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: two stacked cards */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* Upper card: Furnace (left) + Fuel (right) */}
                  <div
                    className="rounded-xl border p-4 flex gap-4 items-center"
                    style={{
                      background: "linear-gradient(180deg, rgb(22,18,18) 0%, rgb(15,12,12) 100%)",
                      border: "1px solid rgba(255,100,0,0.12)",
                    }}
                  >
                    <div className="shrink-0">
                      <FurnaceVisual
                        active={enhancePhase === "enhancing"}
                        overlay={selectedEquipment ? selectedItemDef?.icon : undefined}
                        overlayLevel={selectedEquipment ? currentEnhLevel : undefined}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <FuelPanel
                        heat={heat}
                        inventory={inventory}
                        locale={locale}
                        onAddFuel={handleAddFuel}
                      />
                    </div>
                  </div>

                  {/* Lower card: Enhancement details */}
                  <div
                    className="rounded-xl border p-4 sm:p-6"
                    style={{
                      background: "linear-gradient(180deg, rgb(35,25,25) 0%, rgb(22,15,15) 100%)",
                      border: "1px solid rgba(255,100,0,0.12)",
                    }}
                  >
                  {selectedEquipment && selectedItemDef ? (
                    <div className="flex flex-col gap-5">

                      {/* Enhancement result display */}
                      {enhancePhase === "result" && enhanceResult && (
                        <div className={`text-center text-lg font-heading font-bold ${
                          enhanceResult === "success" ? "text-jade" : enhanceResult === "break" ? "text-red-500" : "text-orange-400"
                        }`}>
                          {enhanceResult === "success"
                            ? (isZh ? "強化成功！" : "Enhancement Success!")
                            : enhanceResult === "break"
                            ? (isZh ? "裝備碎裂！" : "Equipment Destroyed!")
                            : (isZh ? "強化失敗" : "Enhancement Failed")}
                        </div>
                      )}

                      {/* Current stats -> Enhanced stats */}
                      <div className="space-y-2">
                        <h4 className="font-heading text-sm text-muted-foreground">{isZh ? "屬性預覽" : "Stat Preview"}</h4>
                        <div className="space-y-1">
                          {currentStats.hp > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-red-400">{isZh ? "氣血" : "HP"}</span>
                              <span className="tabular-nums">{currentStats.hp}</span>
                              <span className="text-jade">→</span>
                              <span className="tabular-nums text-jade font-bold">{nextStats.hp}</span>
                              <span className="text-[10px] text-jade">(+{nextStats.hp - currentStats.hp})</span>
                            </div>
                          )}
                          {currentStats.atk > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-spirit-gold">{isZh ? "外功" : "ATK"}</span>
                              <span className="tabular-nums">{currentStats.atk}</span>
                              <span className="text-jade">→</span>
                              <span className="tabular-nums text-jade font-bold">{nextStats.atk}</span>
                              <span className="text-[10px] text-jade">(+{nextStats.atk - currentStats.atk})</span>
                            </div>
                          )}
                          {currentStats.def > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-blue-300">{isZh ? "防禦" : "DEF"}</span>
                              <span className="tabular-nums">{currentStats.def}</span>
                              <span className="text-jade">→</span>
                              <span className="tabular-nums text-jade font-bold">{nextStats.def}</span>
                              <span className="text-[10px] text-jade">(+{nextStats.def - currentStats.def})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Enhancement level + success rate */}
                      {enhInfo && (
                        <div className="text-center space-y-1">
                          <p className="text-2xl font-heading font-bold">
                            <span className="text-muted-foreground">+{currentEnhLevel}</span>
                            <span className="text-jade mx-2">→</span>
                            <span className="text-spirit-gold">+{targetLevel}</span>
                          </p>
                          <p className={`text-lg font-heading font-bold tabular-nums ${
                            enhInfo.rate >= 75 ? "text-jade" : enhInfo.rate >= 40 ? "text-yellow-400" : enhInfo.rate >= 15 ? "text-orange-400" : "text-red-400"
                          }`}>
                            {isZh ? "成功率" : "Success"}: {enhInfo.rate}%
                          </p>
                        </div>
                      )}

                      {/* Cost */}
                      {enhInfo && (
                        <div className="space-y-2">
                          <h4 className="font-heading text-sm text-muted-foreground">{isZh ? "強化費用" : "Enhancement Cost"}</h4>
                          <div className="space-y-1">
                            {barItem && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className={barItem.color}>{barItem.icon}</span>
                                <span>{isZh ? barItem.nameZh : barItem.nameEn}</span>
                                <span className="tabular-nums">x{enhInfo.barCost}</span>
                                <span className={`text-xs tabular-nums ${barOwned >= enhInfo.barCost ? "text-jade" : "text-red-400"}`}>
                                  {isZh ? "有" : "own"}: {barOwned} {barOwned >= enhInfo.barCost ? "✅" : "❌"}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-300">🪙</span>
                              <span>{isZh ? "銀兩" : "Silver"}</span>
                              <span className="tabular-nums">x{enhInfo.silverCost.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span>🔥</span>
                              <span>{isZh ? "熱值" : "Heat"}</span>
                              <span className="tabular-nums">{enhInfo.heatCost}</span>
                              <span className={`text-xs tabular-nums ${heat >= enhInfo.heatCost ? "text-jade" : "text-red-400"}`}>
                                {isZh ? "有" : "have"}: {heat} {heat >= enhInfo.heatCost ? "✅" : "❌"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Failure consequence */}
                      {enhInfo && failInfo.text && (
                        <p className={`text-xs ${failInfo.color}`}>{failInfo.text}</p>
                      )}

                      {/* Confirmation dialog for +11 and above */}
                      {showConfirmDialog && (
                        <div
                          className="rounded-lg border border-red-700/50 p-4 space-y-3"
                          style={{ background: "rgba(127,29,29,0.15)" }}
                        >
                          <p className="text-sm text-red-300 font-heading">
                            {isZh
                              ? `+${targetLevel} 強化有碎裂風險，確定要繼續嗎？`
                              : `+${targetLevel} enhancement risks destruction. Continue?`}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowConfirmDialog(false)}
                              className="flex-1 border-border/50"
                            >
                              {isZh ? "取消" : "Cancel"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleEnhance}
                              className="flex-1 bg-red-800 hover:bg-red-700 text-white font-heading"
                            >
                              {isZh ? "確認強化" : "Confirm"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Enhance button */}
                      {!showConfirmDialog && (
                        <Button
                          onClick={handleEnhance}
                          disabled={enhancePhase !== "idle" || !enhInfo}
                          className={`w-full font-heading text-base h-11 ${
                            enhancePhase === "enhancing"
                              ? "bg-orange-900 text-orange-200 border border-orange-700/50"
                              : "bg-cinnabar hover:bg-cinnabar/90 text-white"
                          }`}
                          style={enhancePhase === "idle" ? { boxShadow: "0 0 12px rgba(180,60,30,0.4)" } : undefined}
                        >
                          {enhancePhase === "enhancing"
                            ? (isZh ? "強化中..." : "Enhancing...")
                            : `🔨 ${isZh ? "強化" : "Enhance"}`}
                        </Button>
                      )}

                      {/* Max level reached */}
                      {!enhInfo && currentEnhLevel >= 15 && (
                        <p className="text-center text-sm font-heading text-spirit-gold">
                          {isZh ? "已達最高強化等級" : "Max enhancement level reached"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                      {isZh ? "從左側選擇要強化的裝備" : "Select equipment from the left panel"}
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      </div>

      {/* CSS for furnace animation */}
      <style jsx global>{`
        @keyframes furnace-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-2px) rotate(-1deg); }
          75% { transform: translateX(2px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
