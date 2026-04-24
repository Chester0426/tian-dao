"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  type MaterialTier,
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

function getItemImage(itemType: string): string | undefined {
  return ITEMS[itemType]?.image;
}

function getInvQty(inventory: { item_type: string; quantity: number }[], itemType: string): number {
  return inventory.find((i) => i.item_type === itemType)?.quantity ?? 0;
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type SmithingTab = "smelting" | "forging" | "enhancement";

// ---------------------------------------------------------------------------
// Enhancement state
// ---------------------------------------------------------------------------

type EnhancePhase = "idle" | "enhancing" | "result";

// ---------------------------------------------------------------------------
// XP Bar (reused across tabs)
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
            background: "linear-gradient(90deg, #7f1d1d, #dc2626, #f97316, #fbbf24)",
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
// Fuel Buttons
// ---------------------------------------------------------------------------

function FuelButtons({
  inventory,
  locale,
  onAddFuel,
}: {
  inventory: { item_type: string; quantity: number }[];
  locale: string;
  onAddFuel: (fuelItem: string, heat: number) => void;
}) {
  const isZh = locale === "zh";
  return (
    <div className="flex flex-wrap gap-2">
      {FUELS.map((f) => {
        const qty = getInvQty(inventory, f.item);
        return (
          <Button
            key={f.item}
            variant="outline"
            size="sm"
            disabled={qty <= 0}
            onClick={() => onAddFuel(f.item, f.heat)}
            className="font-heading text-xs border-orange-800/50 hover:border-orange-600/70 hover:bg-orange-950/30 disabled:opacity-40"
          >
            {isZh ? f.heatZh : f.heatEn} +{f.heat}
            <span className="ml-1 text-muted-foreground tabular-nums">(x{qty})</span>
          </Button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crafting Progress Bar (green, for smelting/forging)
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
        className={`text-[120px] leading-none select-none transition-all duration-300 ${active ? "animate-pulse" : "opacity-40"}`}
        style={{
          filter: active ? "drop-shadow(0 0 24px rgba(249,115,22,0.6)) drop-shadow(0 0 48px rgba(220,38,38,0.3))" : "none",
          animation: active ? "furnace-shake 0.3s ease-in-out infinite" : "none",
        }}
      >
        {overlay ? (
          <div className="relative inline-block">
            <span>🔥</span>
            <span className="absolute inset-0 flex items-center justify-center text-4xl" style={{ textShadow: "0 0 8px #000" }}>
              {overlay}
              {overlayLevel !== undefined && overlayLevel > 0 && (
                <span className="text-lg font-heading font-bold text-spirit-gold ml-0.5">+{overlayLevel}</span>
              )}
            </span>
          </div>
        ) : (
          <span>🔥</span>
        )}
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

  // Dummy smithing stats (to be wired later)
  const smithingLevel = 1;
  const smithingXp = 0;
  const smithingXpMax = miningXpForLevel(1);

  // Tab state
  const [activeTab, setActiveTab] = useState<SmithingTab>("smelting");

  // Shared furnace state
  const [heat, setHeat] = useState(0);
  const [autoRefuel, setAutoRefuel] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<string>(FUELS[0].item);

  // Smelting state
  const [selectedRecipe, setSelectedRecipe] = useState<SmeltingRecipe | null>(SMELTING_RECIPES[0] ?? null);
  const [smeltingActive, setSmeltingActive] = useState(false);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [smeltCount, setSmeltCount] = useState(0);

  // Forging state
  const [selectedTier, setSelectedTier] = useState<MaterialTier>("copper");
  const [selectedForging, setSelectedForging] = useState<ForgingRecipe | null>(COPPER_FORGING[0] ?? null);
  const [forgingActive, setForgingActive] = useState(false);
  const [forgeProgress, setForgeProgress] = useState(0);
  const [forgeCount, setForgeCount] = useState(0);

  // Enhancement state
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [enhancePhase, setEnhancePhase] = useState<EnhancePhase>("idle");
  const [enhanceResult, setEnhanceResult] = useState<"success" | "fail" | "break" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Simulated enhancement level for selected equipment (local state only)
  const [equipEnhanceLevels, setEquipEnhanceLevels] = useState<Record<string, number>>({});

  // Crafting tick simulation (smelting)
  const smeltTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (smeltingActive && selectedRecipe) {
      const tickMs = 100;
      const totalTicks = (selectedRecipe.time * 1000) / tickMs;
      let tick = 0;
      smeltTimerRef.current = setInterval(() => {
        tick++;
        setSmeltProgress((tick / totalTicks) * 100);
        if (tick >= totalTicks) {
          setSmeltCount((c) => c + 1);
          tick = 0;
          setSmeltProgress(0);
        }
      }, tickMs);
      return () => { if (smeltTimerRef.current) clearInterval(smeltTimerRef.current); };
    } else {
      setSmeltProgress(0);
    }
  }, [smeltingActive, selectedRecipe]);

  // Crafting tick simulation (forging)
  const forgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (forgingActive && selectedForging) {
      const tickMs = 100;
      const totalTicks = (selectedForging.time * 1000) / tickMs;
      let tick = 0;
      forgeTimerRef.current = setInterval(() => {
        tick++;
        setForgeProgress((tick / totalTicks) * 100);
        if (tick >= totalTicks) {
          setForgeCount((c) => c + 1);
          tick = 0;
          setForgeProgress(0);
        }
      }, tickMs);
      return () => { if (forgeTimerRef.current) clearInterval(forgeTimerRef.current); };
    } else {
      setForgeProgress(0);
    }
  }, [forgingActive, selectedForging]);

  // Enhancement animation
  const enhanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEnhance = useCallback(() => {
    if (!selectedEquipment) return;
    const currentLevel = equipEnhanceLevels[selectedEquipment] ?? 0;
    const targetLevel = currentLevel + 1;

    // +11 and above: show confirmation
    if (targetLevel >= 11 && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }
    setShowConfirmDialog(false);

    const enhInfo = ENHANCEMENT_TABLE.find((e) => e.level === targetLevel);
    if (!enhInfo) return;

    setEnhancePhase("enhancing");
    enhanceTimerRef.current = setTimeout(() => {
      // Simulate result based on rate
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
        // consume = materials lost but level unchanged
      }
      setEnhancePhase("result");
      setTimeout(() => {
        setEnhancePhase("idle");
        setEnhanceResult(null);
      }, 2000);
    }, 1500);
  }, [selectedEquipment, equipEnhanceLevels, showConfirmDialog]);

  // Cleanup enhancement timer
  useEffect(() => {
    return () => { if (enhanceTimerRef.current) clearTimeout(enhanceTimerRef.current); };
  }, []);

  // Add fuel handler
  const handleAddFuel = useCallback((fuelItem: string, heatVal: number) => {
    setHeat((h) => Math.min(h + heatVal, MAX_HEAT));
    setSelectedFuel(fuelItem);
  }, []);

  // Equipment from inventory
  const equipmentItems = inventory.filter((i) => hasTag(i.item_type, "equipment"));

  // XP bar percent
  const xpPercent = smithingXpMax > 0 ? Math.min((smithingXp / smithingXpMax) * 100, 100) : 0;

  // Current forging recipes
  const currentForgingRecipes = FORGING_RECIPES[selectedTier] ?? [];

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
          <div className="relative mt-4">
            <Separator />
          </div>
        </header>

        {/* Skill XP bar */}
        <div className="mb-6 -mx-6 md:-mx-12">
          <XpBar xp={smithingXp} xpMax={smithingXpMax} label={isZh ? "煉器經驗" : "Smithing XP"} />
        </div>

        {/* === Tab Buttons === */}
        <div className="flex gap-2 mb-6">
          {([
            { key: "smelting" as SmithingTab, zh: "煉錠", en: "Smelting" },
            { key: "forging" as SmithingTab, zh: "鍛造", en: "Forging" },
            { key: "enhancement" as SmithingTab, zh: "強化", en: "Enhancement" },
          ]).map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className={`font-heading text-sm ${
                activeTab === tab.key
                  ? "bg-jade text-white border-jade hover:bg-jade/90"
                  : "border-border/50 hover:border-jade/40"
              }`}
            >
              {isZh ? tab.zh : tab.en}
            </Button>
          ))}
        </div>

        {/* === TAB CONTENT === */}

        {/* ================================================================ */}
        {/* TAB 1: SMELTING */}
        {/* ================================================================ */}
        {activeTab === "smelting" && (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Recipe List */}
            <div
              className="w-full md:w-[280px] shrink-0 rounded-xl border border-border/30 overflow-hidden"
              style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
            >
              <div className="p-3 border-b border-border/20">
                <h3 className="font-heading text-sm text-muted-foreground">{isZh ? "配方列表" : "Recipes"}</h3>
              </div>
              <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                {SMELTING_RECIPES.map((recipe) => {
                  const locked = smithingLevel < recipe.level;
                  const isSelected = selectedRecipe?.id === recipe.id;
                  const outputItem = getItem(recipe.output);
                  return (
                    <button
                      key={recipe.id}
                      onClick={() => !locked && setSelectedRecipe(recipe)}
                      disabled={locked}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                        locked
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                          ? "bg-jade/10 border-l-2 border-jade"
                          : "hover:bg-card/60 border-l-2 border-transparent"
                      }`}
                    >
                      <span className={`text-xl ${outputItem?.color ?? "text-foreground"}`}>
                        {outputItem?.icon ?? "○"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-sm truncate">
                          {locked ? "???" : isZh ? recipe.nameZh : recipe.nameEn}
                          {locked && <span className="ml-1">🔒</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {isZh ? `等級 ${recipe.level}` : `Lv.${recipe.level}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Furnace Panel */}
            <div
              className="flex-1 rounded-xl border border-border/30 p-4 sm:p-6"
              style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
            >
              {selectedRecipe ? (
                <div className="flex flex-col gap-5">
                  {/* Furnace */}
                  <FurnaceVisual active={smeltingActive} />

                  {/* Crafting progress */}
                  <CraftingProgressBar progress={smeltProgress} />

                  {/* Completed counter */}
                  {smeltCount > 0 && (
                    <p className="text-center text-sm font-heading text-jade">
                      {isZh ? selectedRecipe.nameZh : selectedRecipe.nameEn} x{smeltCount} {isZh ? "已完成" : "completed"}
                    </p>
                  )}

                  {/* Heat bar */}
                  <HeatBar heat={heat} max={MAX_HEAT} />

                  {/* Fuel buttons */}
                  <FuelButtons inventory={inventory} locale={locale} onAddFuel={handleAddFuel} />

                  {/* Auto-refuel toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAutoRefuel(!autoRefuel)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${autoRefuel ? "bg-jade" : "bg-border/50"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          autoRefuel ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {isZh ? "自動添料" : "Auto-refuel"}
                    </span>
                    {autoRefuel && (
                      <span className="text-xs text-jade tabular-nums">
                        ({isZh
                          ? FUELS.find((f) => f.item === selectedFuel)?.heatZh
                          : FUELS.find((f) => f.item === selectedFuel)?.heatEn})
                      </span>
                    )}
                  </div>

                  <Separator className="opacity-30" />

                  {/* Recipe info */}
                  <div className="space-y-2">
                    <h4 className="font-heading text-sm text-muted-foreground">{isZh ? "所需材料" : "Materials"}</h4>
                    {selectedRecipe.materials.map((mat) => {
                      const matItem = getItem(mat.item);
                      const owned = getInvQty(inventory, mat.item);
                      const enough = owned >= mat.qty;
                      return (
                        <div key={mat.item} className="flex items-center gap-2 text-sm">
                          <span className={matItem?.color ?? "text-foreground"}>{matItem?.icon ?? "○"}</span>
                          <span>{isZh ? (matItem?.nameZh ?? mat.item) : (matItem?.nameEn ?? mat.item)}</span>
                          <span className="tabular-nums">x{mat.qty}</span>
                          <span className={`text-xs tabular-nums ${enough ? "text-jade" : "text-red-400"}`}>
                            ({isZh ? "有" : "own"}: {owned})
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                      <span>🔥 {isZh ? "熱量" : "Heat"}: {selectedRecipe.heat}</span>
                      <span>⭐ {isZh ? "經驗" : "XP"}: {selectedRecipe.xp}</span>
                      <span>⏱ {isZh ? "時間" : "Time"}: {selectedRecipe.time}s</span>
                    </div>
                  </div>

                  {/* Start / Stop button */}
                  <Button
                    onClick={() => setSmeltingActive(!smeltingActive)}
                    className={`w-full font-heading text-base h-11 ${
                      smeltingActive
                        ? "bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50"
                        : "bg-cinnabar hover:bg-cinnabar/90 text-white"
                    }`}
                    style={!smeltingActive ? { boxShadow: "0 0 12px rgba(180,60,30,0.4)" } : undefined}
                  >
                    {smeltingActive ? (isZh ? "停止煉錠" : "Stop Smelting") : (isZh ? "開始煉錠" : "Start Smelting")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  {isZh ? "選擇一個配方" : "Select a recipe"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: FORGING */}
        {/* ================================================================ */}
        {activeTab === "forging" && (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Equipment List */}
            <div
              className="w-full md:w-[280px] shrink-0 rounded-xl border border-border/30 overflow-hidden"
              style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
            >
              {/* Material tier tabs */}
              <div className="flex border-b border-border/20 overflow-x-auto">
                {MATERIAL_TIERS.map((tier) => {
                  const locked = smithingLevel < tier.minLevel;
                  const isActive = selectedTier === tier.key;
                  return (
                    <button
                      key={tier.key}
                      onClick={() => {
                        if (!locked) {
                          setSelectedTier(tier.key);
                          const recipes = FORGING_RECIPES[tier.key];
                          setSelectedForging(recipes[0] ?? null);
                        }
                      }}
                      disabled={locked}
                      className={`flex-1 px-2 py-2 text-xs font-heading whitespace-nowrap transition-all ${
                        locked
                          ? "opacity-40 cursor-not-allowed"
                          : isActive
                          ? "bg-jade/15 text-jade border-b-2 border-jade"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isZh ? tier.nameZh : tier.nameEn}
                      {locked && " 🔒"}
                    </button>
                  );
                })}
              </div>
              {/* Recipe list */}
              <div className="divide-y divide-border/10 max-h-[460px] overflow-y-auto">
                {currentForgingRecipes.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {isZh ? "尚未開放" : "Not yet available"}
                  </div>
                ) : (
                  currentForgingRecipes.map((recipe) => {
                    const locked = smithingLevel < recipe.level;
                    const isSelected = selectedForging?.id === recipe.id;
                    const outputItem = getItem(recipe.output);
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => !locked && setSelectedForging(recipe)}
                        disabled={locked}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                          locked
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-jade/10 border-l-2 border-jade"
                            : "hover:bg-card/60 border-l-2 border-transparent"
                        }`}
                      >
                        <span className={`text-xl ${outputItem?.color ?? "text-foreground"}`}>
                          {outputItem?.icon ?? "○"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading text-sm truncate">
                            {locked ? "???" : isZh ? recipe.nameZh : recipe.nameEn}
                            {locked && <span className="ml-1">🔒</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {isZh ? `等級 ${recipe.level}` : `Lv.${recipe.level}`}
                            {" · "}
                            {isZh
                              ? (SLOT_DISPLAY[recipe.slot]?.zh ?? recipe.slot)
                              : (SLOT_DISPLAY[recipe.slot]?.en ?? recipe.slot)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Furnace Panel */}
            <div
              className="flex-1 rounded-xl border border-border/30 p-4 sm:p-6"
              style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
            >
              {selectedForging ? (
                <div className="flex flex-col gap-5">
                  {/* Furnace */}
                  <FurnaceVisual active={forgingActive} />

                  {/* Crafting progress */}
                  <CraftingProgressBar progress={forgeProgress} />

                  {/* Completed counter */}
                  {forgeCount > 0 && (
                    <p className="text-center text-sm font-heading text-jade">
                      {isZh ? selectedForging.nameZh : selectedForging.nameEn} x{forgeCount} {isZh ? "已完成" : "completed"}
                    </p>
                  )}

                  {/* Heat bar */}
                  <HeatBar heat={heat} max={MAX_HEAT} />

                  {/* Fuel buttons */}
                  <FuelButtons inventory={inventory} locale={locale} onAddFuel={handleAddFuel} />

                  {/* Auto-refuel toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAutoRefuel(!autoRefuel)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${autoRefuel ? "bg-jade" : "bg-border/50"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          autoRefuel ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {isZh ? "自動添料" : "Auto-refuel"}
                    </span>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Equipment slot + stat preview */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{isZh ? "部位" : "Slot"}:</span>
                      <Badge variant="outline" className="text-xs border-border/40">
                        {isZh
                          ? (SLOT_DISPLAY[selectedForging.slot]?.zh ?? selectedForging.slot)
                          : (SLOT_DISPLAY[selectedForging.slot]?.en ?? selectedForging.slot)}
                      </Badge>
                    </div>
                    {/* Stat preview */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {selectedForging.stats.atk && (
                        <span className="text-spirit-gold">{isZh ? "外功" : "ATK"} +{selectedForging.stats.atk}</span>
                      )}
                      {selectedForging.stats.def && (
                        <span className="text-blue-300">{isZh ? "防禦" : "DEF"} +{selectedForging.stats.def}</span>
                      )}
                      {selectedForging.stats.hp && (
                        <span className="text-red-400">{isZh ? "氣血" : "HP"} +{selectedForging.stats.hp}</span>
                      )}
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Recipe info */}
                  <div className="space-y-2">
                    <h4 className="font-heading text-sm text-muted-foreground">{isZh ? "所需材料" : "Materials"}</h4>
                    {selectedForging.materials.map((mat) => {
                      const matItem = getItem(mat.item);
                      const owned = getInvQty(inventory, mat.item);
                      const enough = owned >= mat.qty;
                      return (
                        <div key={mat.item} className="flex items-center gap-2 text-sm">
                          <span className={matItem?.color ?? "text-foreground"}>{matItem?.icon ?? "○"}</span>
                          <span>{isZh ? (matItem?.nameZh ?? mat.item) : (matItem?.nameEn ?? mat.item)}</span>
                          <span className="tabular-nums">x{mat.qty}</span>
                          <span className={`text-xs tabular-nums ${enough ? "text-jade" : "text-red-400"}`}>
                            ({isZh ? "有" : "own"}: {owned})
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                      <span>🔥 {isZh ? "熱量" : "Heat"}: {selectedForging.heat}</span>
                      <span>⭐ {isZh ? "經驗" : "XP"}: {selectedForging.xp}</span>
                      <span>⏱ {isZh ? "時間" : "Time"}: {selectedForging.time}s</span>
                    </div>
                  </div>

                  {/* Start / Stop button */}
                  <Button
                    onClick={() => setForgingActive(!forgingActive)}
                    className={`w-full font-heading text-base h-11 ${
                      forgingActive
                        ? "bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50"
                        : "bg-cinnabar hover:bg-cinnabar/90 text-white"
                    }`}
                    style={!forgingActive ? { boxShadow: "0 0 12px rgba(180,60,30,0.4)" } : undefined}
                  >
                    {forgingActive ? (isZh ? "停止鍛造" : "Stop Forging") : (isZh ? "開始鍛造" : "Start Forging")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  {isZh ? "選擇要鍛造的裝備" : "Select equipment to forge"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: ENHANCEMENT */}
        {/* ================================================================ */}
        {activeTab === "enhancement" && (() => {
          const selectedItemDef = selectedEquipment ? getItem(selectedEquipment) : null;
          const currentEnhLevel = selectedEquipment ? (equipEnhanceLevels[selectedEquipment] ?? 0) : 0;
          const targetLevel = currentEnhLevel + 1;
          const enhInfo = ENHANCEMENT_TABLE.find((e) => e.level === targetLevel) ?? null;
          const barType = selectedEquipment ? getEquipmentBarType(selectedEquipment) : null;
          const barOwned = barType ? getInvQty(inventory, barType) : 0;
          const barItem = barType ? getItem(barType) : null;

          // Calculate stat preview
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

          // Failure consequence text
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
          const failInfo = getFailText(enhInfo);

          return (
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left: Equipment Grid */}
              <div
                className="w-full md:w-[280px] shrink-0 rounded-xl border border-border/30 overflow-hidden"
                style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
              >
                <div className="p-3 border-b border-border/20">
                  <h3 className="font-heading text-sm text-muted-foreground">{isZh ? "選擇裝備" : "Select Equipment"}</h3>
                </div>
                <div className="p-3">
                  {equipmentItems.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {isZh ? "無可強化裝備" : "No equipment to enhance"}
                    </div>
                  ) : (
                    <TooltipProvider>
                      <div className="grid grid-cols-4 gap-2">
                        {equipmentItems.map((item) => {
                          const display = getItem(item.item_type);
                          const isSelected = selectedEquipment === item.item_type;
                          const enhLvl = equipEnhanceLevels[item.item_type] ?? 0;
                          return (
                            <Tooltip key={item.item_type}>
                              <TooltipTrigger
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
                              </TooltipTrigger>
                              <TooltipContent className="p-2 text-xs">
                                <p className="font-heading">{display ? (isZh ? display.nameZh : display.nameEn) : item.item_type}</p>
                                {enhLvl > 0 && <p className="text-spirit-gold">+{enhLvl}</p>}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              {/* Right: Enhancement Furnace Panel */}
              <div
                className="flex-1 rounded-xl border border-border/30 p-4 sm:p-6"
                style={{ background: "linear-gradient(180deg, rgb(30,35,30) 0%, rgb(20,25,20) 100%)" }}
              >
                {selectedEquipment && selectedItemDef ? (
                  <div className="flex flex-col gap-5">
                    {/* Furnace with equipment overlay */}
                    <FurnaceVisual
                      active={enhancePhase === "enhancing"}
                      overlay={selectedItemDef.icon}
                      overlayLevel={currentEnhLevel}
                    />

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

                    {/* Heat bar */}
                    <HeatBar heat={heat} max={MAX_HEAT} />

                    {/* Fuel buttons */}
                    <FuelButtons inventory={inventory} locale={locale} onAddFuel={handleAddFuel} />

                    <Separator className="opacity-30" />

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

                    <Separator className="opacity-30" />

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
                                ({isZh ? "有" : "own"}: {barOwned})
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
                            <span>{isZh ? "熱量" : "Heat"}</span>
                            <span className="tabular-nums">x{enhInfo.heatCost}</span>
                            <span className={`text-xs tabular-nums ${heat >= enhInfo.heatCost ? "text-jade" : "text-red-400"}`}>
                              ({isZh ? "有" : "have"}: {heat})
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
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    {isZh ? "從左側選擇要強化的裝備" : "Select equipment from the left panel"}
                  </div>
                )}
              </div>
            </div>
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
