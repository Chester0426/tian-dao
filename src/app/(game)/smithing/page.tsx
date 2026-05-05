"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useGameState } from "@/components/mining-provider";
import { useI18n } from "@/lib/i18n";
import { getItem, hasTag } from "@/lib/items";
import { miningXpForLevel } from "@/lib/types";
import {
  SMELTING_RECIPES,
  FORGING_RECIPES,
  MATERIAL_TIERS,
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
        className="absolute inset-y-0 left-0 rounded-full"
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

function FurnaceVisual({ active, itemType, overlayLevel }: { active: boolean; itemType?: string; overlayLevel?: number }) {
  const item = itemType ? getItem(itemType) : null;
  const itemLabel = item ? `${item.nameZh} / ${item.nameEn}` : undefined;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`forge-tile ${active ? "forge-tile--active" : "forge-tile--idle"} ${item ? "forge-tile--loaded" : ""}`}>
        <div className="forge-tile__aura" />
        <div className="forge-tile__frame">
          <div className="forge-tile__bevel" />
          <div className="forge-tile__mouth">
            <div className="forge-tile__heatwash" />
            <div className="forge-tile__backwall" />
            <div className="forge-tile__grate">
              <span />
              <span />
              <span />
            </div>
            <div className="forge-tile__coalbed">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="forge-tile__flames" aria-hidden="true">
              <i className="forge-tile__flame forge-tile__flame--left" />
              <i className="forge-tile__flame forge-tile__flame--mid" />
              <i className="forge-tile__flame forge-tile__flame--right" />
              <i className="forge-tile__flame forge-tile__flame--core" />
            </div>
            {item && (
              <div className="forge-tile__item" aria-label={itemLabel}>
                <div className="forge-tile__item-glow" />
                {item.image ? (
                  <img src={item.image} alt="" />
                ) : (
                  <span className={item.color}>{item.icon}</span>
                )}
                {typeof overlayLevel === "number" && overlayLevel > 0 && <b>+{overlayLevel}</b>}
              </div>
            )}
            <div className="forge-tile__impact" aria-hidden="true" />
            <div className="forge-tile__spray" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="forge-tile__sparks" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="forge-tile__rim forge-tile__rim--top" />
          <div className="forge-tile__rim forge-tile__rim--bottom" />
        </div>
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
  const smithingLevel = gameState.smithingLevel;
  const smithingXp = gameState.smithingXp;
  const smithingXpMax = miningXpForLevel(smithingLevel);

  // Tab state: 2 tabs now
  const [activeTab, setActiveTab] = useState<SmithingTab>("craft");

  // Shared furnace state — persisted via DB
  const heat = gameState.furnaceHeat;

  // Craft tab state
  const [selectedRecipe, setSelectedRecipe] = useState<CraftRecipe | null>(null);
  // Server-authoritative state (provider drives ticks)
  const craftActive = gameState.isSmithing;
  const craftProgress = gameState.craftProgress * 100;
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
  }, []);

  // Compute max craftable quantity
  const maxCraftQty = useMemo(() => {
    if (!selectedRecipe) return 0;
    let maxByMat = Infinity;
    for (const mat of selectedRecipe.materials) {
      const owned = getInvQty(inventory, mat.item);
      maxByMat = Math.min(maxByMat, Math.floor(owned / mat.qty));
    }
    const result = maxByMat;
    return result === Infinity ? 0 : result;
  }, [selectedRecipe, inventory]);

  // Crafting is server-authoritative — provider runs the tick loop.
  // When SSR resumes a smithing session, sync the selectedRecipe from provider.
  useEffect(() => {
    if (craftActive && gameState.smithingRecipeId && (!selectedRecipe || selectedRecipe.id !== gameState.smithingRecipeId)) {
      for (const group of RECIPE_GROUPS) {
        const found = group.recipes.find((r) => r.id === gameState.smithingRecipeId);
        if (found) {
          setSelectedRecipe(found);
          return;
        }
      }
    }
  }, [craftActive, gameState.smithingRecipeId]);

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
                                      if (gameState.isSmithing) gameState.stopSmithing();
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
                                  {outputItem?.image ? (
                                    <img src={outputItem.image} alt="" className="w-6 h-6 object-contain shrink-0" />
                                  ) : (
                                    <span className={`text-lg ${outputItem?.color ?? "text-foreground"}`}>
                                      {outputItem?.icon ?? "○"}
                                    </span>
                                  )}
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
                  <div className="shrink-0 mx-auto">
                    <FurnaceVisual active={craftActive} itemType={selectedRecipe?.output} />
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
                        const enough = owned >= mat.qty;
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
                              <span className="text-muted-foreground tabular-nums">×{mat.qty}</span>
                            </div>
                            <span className={`text-xs tabular-nums font-bold ${enough ? "text-jade" : "text-red-400"}`}>
                              <span className="text-muted-foreground font-normal mr-1">{isZh ? "擁有" : "Have"}</span>
                              {owned}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    </div>

                    {/* Crafting progress */}
                    <CraftingProgressBar progress={craftProgress} />

                    {/* Start / Stop button */}
                    <Button
                      onClick={() => {
                        if (craftActive) {
                          gameState.stopSmithing();
                        } else if (selectedRecipe) {
                          gameState.startSmithing(selectedRecipe.id);
                        }
                      }}
                      disabled={!selectedRecipe || (!craftActive && maxCraftQty <= 0)}
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
                    <div className="shrink-0 mx-auto">
                      <FurnaceVisual
                        active={enhancePhase === "enhancing"}
                        itemType={selectedEquipment ?? undefined}
                        overlayLevel={selectedEquipment ? currentEnhLevel : undefined}
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
        .forge-tile {
          position: relative;
          width: 8.25rem;
          height: 8.25rem;
          isolation: isolate;
          user-select: none;
          transform: translateZ(0);
        }

        .forge-tile__aura {
          position: absolute;
          inset: -0.35rem;
          border-radius: 1.65rem;
          background:
            radial-gradient(circle at 50% 58%, rgba(255, 135, 34, 0.42), transparent 44%),
            radial-gradient(circle at 50% 76%, rgba(127, 29, 29, 0.32), transparent 55%);
          filter: blur(14px);
          opacity: 0;
          transform: scale(0.95);
          transition: opacity 180ms ease, transform 180ms ease;
          z-index: -1;
        }

        .forge-tile--active .forge-tile__aura {
          opacity: 1;
          transform: scale(1);
          animation: forge-tile-aura 1.15s ease-in-out infinite;
        }

        .forge-tile__frame {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 1.45rem;
          background:
            linear-gradient(145deg, rgba(255, 201, 124, 0.16), transparent 22%),
            radial-gradient(circle at 50% 113%, rgba(0, 0, 0, 0.85), transparent 31%),
            linear-gradient(145deg, #4a2a1e 0%, #251917 42%, #090707 100%);
          border: 1px solid rgba(255, 147, 72, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 222, 170, 0.12),
            inset 0 -18px 28px rgba(0, 0, 0, 0.56),
            0 12px 24px rgba(0, 0, 0, 0.42);
        }

        .forge-tile--active .forge-tile__frame {
          border-color: rgba(255, 151, 61, 0.44);
          box-shadow:
            inset 0 1px 0 rgba(255, 228, 177, 0.2),
            inset 0 -18px 28px rgba(0, 0, 0, 0.5),
            0 0 18px rgba(249, 115, 22, 0.24),
            0 12px 24px rgba(0, 0, 0, 0.44);
        }

        .forge-tile__bevel {
          position: absolute;
          inset: 0.52rem;
          border-radius: 1.05rem;
          background:
            linear-gradient(135deg, rgba(246, 195, 95, 0.24), transparent 16%, transparent 82%, rgba(0, 0, 0, 0.45)),
            linear-gradient(180deg, #3a231c, #110c0b);
          border: 1px solid rgba(255, 194, 108, 0.14);
          box-shadow:
            inset 0 2px 0 rgba(255, 232, 178, 0.08),
            inset 0 -10px 16px rgba(0, 0, 0, 0.42);
        }

        .forge-tile__mouth {
          position: absolute;
          inset: 1.48rem;
          overflow: hidden;
          border-radius: 0.82rem;
          background:
            radial-gradient(circle at 50% 104%, rgba(52, 18, 10, 0.8), transparent 38%),
            linear-gradient(180deg, #030202 0%, #0a0504 65%, #1a0b07 100%);
          border: 1px solid rgba(255, 176, 92, 0.13);
          box-shadow:
            inset 0 0 22px rgba(0, 0, 0, 0.9),
            inset 0 -8px 16px rgba(80, 28, 13, 0.28),
            0 0 0 0.42rem rgba(0, 0, 0, 0.18);
        }

        .forge-tile--active .forge-tile__mouth {
          border-color: rgba(255, 177, 80, 0.42);
          box-shadow:
            inset 0 0 18px rgba(0, 0, 0, 0.72),
            inset 0 -12px 24px rgba(255, 83, 18, 0.48),
            0 0 0 0.42rem rgba(0, 0, 0, 0.18),
            0 0 16px rgba(249, 115, 22, 0.34);
        }

        .forge-tile__backwall {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.025), transparent 20%, transparent 80%, rgba(255, 255, 255, 0.02)),
            radial-gradient(circle at 50% 78%, rgba(255, 196, 91, 0.18), transparent 35%);
          opacity: 0.45;
        }

        .forge-tile__heatwash {
          position: absolute;
          inset: -0.75rem;
          z-index: 0;
          background:
            radial-gradient(circle at 50% 74%, rgba(255, 244, 177, 0.92), transparent 16%),
            radial-gradient(circle at 50% 74%, rgba(255, 119, 18, 0.88), transparent 36%),
            radial-gradient(circle at 50% 88%, rgba(127, 29, 29, 0.72), transparent 58%);
          opacity: 0.08;
          transition: opacity 200ms ease;
        }

        .forge-tile--active .forge-tile__heatwash {
          opacity: 1;
          animation: forge-tile-heat 780ms ease-in-out infinite;
        }

        .forge-tile__grate {
          position: absolute;
          left: 1rem;
          right: 1rem;
          bottom: 1.24rem;
          z-index: 3;
          height: 0.3rem;
          display: flex;
          justify-content: space-between;
          opacity: 0.42;
        }

        .forge-tile__grate span {
          width: 1.25rem;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(180deg, #7b6658, #19100d);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        }

        .forge-tile__coalbed {
          position: absolute;
          left: 0.95rem;
          right: 0.95rem;
          bottom: 0.52rem;
          z-index: 3;
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 0.18rem;
        }

        .forge-tile__coalbed span {
          width: 0.88rem;
          height: 0.42rem;
          border-radius: 999px;
          background: #25110c;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .forge-tile--active .forge-tile__coalbed span {
          background: linear-gradient(180deg, #ffe68b, #f97316 48%, #66160b);
          box-shadow: 0 0 9px rgba(249, 115, 22, 0.85);
          animation: forge-tile-coal 620ms ease-in-out infinite alternate;
        }

        .forge-tile--active .forge-tile__coalbed span:nth-child(2),
        .forge-tile--active .forge-tile__coalbed span:nth-child(4) {
          animation-delay: 160ms;
        }

        .forge-tile__flames {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0.56rem;
          z-index: 2;
          height: 4.25rem;
          opacity: 0;
          transform: translateY(1rem) scale(0.7);
          transform-origin: 50% 100%;
          transition: opacity 170ms ease, transform 190ms ease;
        }

        .forge-tile--active .forge-tile__flames {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .forge-tile__flame {
          position: absolute;
          left: 50%;
          bottom: 0;
          display: block;
          border-radius: 58% 42% 56% 44% / 68% 42% 58% 32%;
          transform-origin: 50% 100%;
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 8px rgba(255, 111, 24, 0.74));
        }

        .forge-tile__flame--mid {
          width: 1.55rem;
          height: 3.45rem;
          margin-left: -0.78rem;
          background: linear-gradient(180deg, #ff2536 0%, #ff7a18 38%, #ffd447 74%, #fff3b4 100%);
        }

        .forge-tile__flame--left {
          width: 1.16rem;
          height: 2.7rem;
          margin-left: -1.58rem;
          background: linear-gradient(180deg, #ff3726 0%, #ff7a18 50%, #ffd166 100%);
        }

        .forge-tile__flame--right {
          width: 1.12rem;
          height: 2.9rem;
          margin-left: 0.54rem;
          background: linear-gradient(180deg, #ff1f2f 0%, #ff6418 54%, #ffc542 100%);
        }

        .forge-tile__flame--core {
          width: 0.88rem;
          height: 2rem;
          margin-left: -0.44rem;
          background: linear-gradient(180deg, #fff8d5 0%, #ffe45a 58%, #ff9f1a 100%);
          filter: drop-shadow(0 0 9px rgba(255, 244, 170, 0.8));
        }

        .forge-tile--active .forge-tile__flame--mid { animation: forge-tile-flame-mid 520ms ease-in-out infinite alternate; }
        .forge-tile--active .forge-tile__flame--left { animation: forge-tile-flame-left 460ms ease-in-out infinite alternate; }
        .forge-tile--active .forge-tile__flame--right { animation: forge-tile-flame-right 580ms ease-in-out infinite alternate; }
        .forge-tile--active .forge-tile__flame--core { animation: forge-tile-flame-core 380ms ease-in-out infinite alternate; }

        .forge-tile__item {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 5;
          width: 3.35rem;
          height: 3.35rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.72rem;
          background:
            radial-gradient(circle at 50% 48%, rgba(255, 232, 176, 0.12), transparent 58%),
            rgba(5, 4, 4, 0.68);
          border: 1px solid rgba(255, 214, 148, 0.2);
          box-shadow:
            0 8px 16px rgba(0, 0, 0, 0.48),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transform: translate(-50%, -48%) rotate(-4deg);
        }

        .forge-tile__item-glow {
          position: absolute;
          inset: -0.5rem;
          border-radius: 1rem;
          background: radial-gradient(circle, rgba(255, 177, 72, 0.42), transparent 64%);
          filter: blur(8px);
          opacity: 0;
          transition: opacity 180ms ease;
        }

        .forge-tile__item img,
        .forge-tile__item > span {
          position: relative;
          z-index: 1;
          width: 2.72rem;
          height: 2.72rem;
          object-fit: contain;
          filter:
            drop-shadow(0 3px 4px rgba(0, 0, 0, 0.66))
            drop-shadow(0 0 5px rgba(255, 255, 255, 0.18));
        }

        .forge-tile__item > span {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          line-height: 1;
        }

        .forge-tile__item b {
          position: absolute;
          right: -0.26rem;
          bottom: -0.24rem;
          z-index: 2;
          min-width: 1.08rem;
          height: 1.08rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.82);
          color: #f6c35f;
          border: 1px solid rgba(246, 195, 95, 0.44);
          font-size: 0.58rem;
          line-height: 1;
        }

        .forge-tile--active .forge-tile__item {
          border-color: rgba(255, 205, 112, 0.64);
          box-shadow:
            0 0 20px rgba(249, 115, 22, 0.52),
            0 8px 16px rgba(0, 0, 0, 0.5),
            inset 0 0 16px rgba(255, 106, 19, 0.26);
          animation: forge-tile-item-hit 520ms ease-in-out infinite;
        }

        .forge-tile--active .forge-tile__item-glow {
          opacity: 1;
          animation: forge-tile-item-glow 520ms ease-in-out infinite;
        }

        .forge-tile--active .forge-tile__item img,
        .forge-tile--active .forge-tile__item > span {
          filter:
            brightness(1.2)
            saturate(1.12)
            drop-shadow(0 3px 4px rgba(0, 0, 0, 0.66))
            drop-shadow(0 0 9px rgba(255, 177, 72, 0.82));
        }

        .forge-tile__impact {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 6;
          width: 4.35rem;
          height: 0.22rem;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, #fff1b8 30%, #ff8a1d 52%, transparent);
          opacity: 0;
          filter: drop-shadow(0 0 9px rgba(255, 194, 92, 0.88));
          transform: translate(-50%, -50%) rotate(-16deg) scaleX(0.32);
        }

        .forge-tile--active .forge-tile__impact {
          animation: forge-tile-impact 520ms ease-out infinite;
        }

        .forge-tile__spray {
          position: absolute;
          inset: 0;
          z-index: 7;
          opacity: 0;
          pointer-events: none;
        }

        .forge-tile--active .forge-tile__spray {
          opacity: 1;
        }

        .forge-tile__spray span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0.6rem;
          height: 0.12rem;
          border-radius: 999px;
          background: linear-gradient(90deg, #fffbd1 0%, #ffc24f 48%, rgba(255, 116, 24, 0.3) 78%, transparent 100%);
          box-shadow:
            0 0 8px rgba(255, 238, 170, 0.95),
            0 0 14px rgba(249, 115, 22, 0.72);
          opacity: 0;
          transform-origin: left center;
          animation: forge-tile-spray 720ms cubic-bezier(0.2, 0.68, 0.38, 1) infinite;
        }

        .forge-tile__spray::before,
        .forge-tile__spray::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4.75rem;
          height: 4.75rem;
          border-radius: 999px;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.7);
          background:
            radial-gradient(circle at 18% 42%, rgba(255, 247, 190, 0.98) 0 0.09rem, transparent 0.13rem),
            radial-gradient(circle at 30% 22%, rgba(255, 179, 52, 0.95) 0 0.075rem, transparent 0.12rem),
            radial-gradient(circle at 69% 18%, rgba(255, 247, 190, 0.96) 0 0.08rem, transparent 0.13rem),
            radial-gradient(circle at 83% 44%, rgba(255, 179, 52, 0.95) 0 0.08rem, transparent 0.13rem),
            radial-gradient(circle at 72% 76%, rgba(255, 247, 190, 0.9) 0 0.07rem, transparent 0.12rem),
            radial-gradient(circle at 24% 72%, rgba(255, 179, 52, 0.9) 0 0.07rem, transparent 0.12rem);
          filter: drop-shadow(0 0 7px rgba(255, 190, 70, 0.92));
          animation: forge-tile-spark-burst 720ms ease-out infinite;
        }

        .forge-tile__spray::after {
          width: 3.7rem;
          height: 3.7rem;
          transform: translate(-50%, -50%) rotate(24deg) scale(0.65);
          animation-delay: 220ms;
        }

        .forge-tile__spray span:nth-child(1) { --sx: -2.75rem; --sy: -1.28rem; --sr: 198deg; animation-delay: 0ms; }
        .forge-tile__spray span:nth-child(2) { --sx: -2.34rem; --sy: -0.52rem; --sr: 184deg; animation-delay: 42ms; }
        .forge-tile__spray span:nth-child(3) { --sx: -1.7rem; --sy: 0.74rem; --sr: 154deg; animation-delay: 82ms; }
        .forge-tile__spray span:nth-child(4) { --sx: -0.72rem; --sy: -2.2rem; --sr: 238deg; animation-delay: 124ms; }
        .forge-tile__spray span:nth-child(5) { --sx: 0.58rem; --sy: -2.36rem; --sr: 300deg; animation-delay: 20ms; }
        .forge-tile__spray span:nth-child(6) { --sx: 1.52rem; --sy: -1.45rem; --sr: 328deg; animation-delay: 62ms; }
        .forge-tile__spray span:nth-child(7) { --sx: 2.58rem; --sy: -0.7rem; --sr: 350deg; animation-delay: 104ms; }
        .forge-tile__spray span:nth-child(8) { --sx: 2.1rem; --sy: 0.52rem; --sr: 24deg; animation-delay: 146ms; }
        .forge-tile__spray span:nth-child(9) { --sx: 0.92rem; --sy: 1.34rem; --sr: 54deg; animation-delay: 186ms; }
        .forge-tile__spray span:nth-child(10) { --sx: -0.9rem; --sy: 1.2rem; --sr: 126deg; animation-delay: 226ms; }

        .forge-tile__sparks {
          position: absolute;
          inset: 0.5rem 0.55rem 1rem;
          z-index: 7;
          opacity: 0;
          pointer-events: none;
        }

        .forge-tile--active .forge-tile__sparks {
          opacity: 1;
        }

        .forge-tile__sparks span {
          position: absolute;
          bottom: 0.7rem;
          width: 0.16rem;
          height: 0.16rem;
          border-radius: 999px;
          background: #ffd166;
          box-shadow: 0 0 7px rgba(255, 209, 102, 0.9);
          animation: forge-tile-spark 1.2s linear infinite;
        }

        .forge-tile__sparks span:nth-child(1) { left: 27%; animation-delay: 0ms; }
        .forge-tile__sparks span:nth-child(2) { left: 42%; animation-delay: 190ms; }
        .forge-tile__sparks span:nth-child(3) { left: 56%; animation-delay: 390ms; }
        .forge-tile__sparks span:nth-child(4) { left: 68%; animation-delay: 610ms; }
        .forge-tile__sparks span:nth-child(5) { left: 36%; animation-delay: 850ms; }

        .forge-tile__rim {
          position: absolute;
          left: 1rem;
          right: 1rem;
          height: 0.34rem;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255, 218, 150, 0.28), transparent);
          opacity: 0.65;
        }

        .forge-tile__rim--top {
          top: 1.07rem;
        }

        .forge-tile__rim--bottom {
          bottom: 1.08rem;
          opacity: 0.36;
        }

        .forge-tile__workpiece {
          position: absolute;
          right: 0.58rem;
          top: 0.58rem;
          z-index: 3;
          min-width: 1.72rem;
          height: 1.72rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.52rem;
          background: rgba(4, 3, 3, 0.78);
          border: 1px solid rgba(255, 207, 135, 0.22);
          box-shadow: 0 7px 14px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          font-size: 0.98rem;
        }

        .forge-tile--active .forge-tile__workpiece {
          border-color: rgba(255, 190, 90, 0.58);
          box-shadow: 0 0 14px rgba(249, 115, 22, 0.34), 0 7px 14px rgba(0, 0, 0, 0.46);
        }

        .forge-tile__workpiece b {
          position: absolute;
          right: -0.2rem;
          bottom: -0.2rem;
          min-width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.78);
          color: #f6c35f;
          border: 1px solid rgba(246, 195, 95, 0.38);
          font-size: 0.58rem;
          line-height: 1;
        }

        @keyframes forge-tile-aura {
          0%, 100% { opacity: 0.65; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        @keyframes forge-tile-heat {
          0%, 100% { opacity: 0.82; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        @keyframes forge-tile-coal {
          0% { filter: brightness(0.82); transform: translateY(0); }
          100% { filter: brightness(1.35); transform: translateY(-1px); }
        }

        @keyframes forge-tile-flame-mid {
          0% { transform: translateX(-1px) scaleX(0.94) scaleY(0.94) rotate(-3deg); }
          100% { transform: translateX(1px) scaleX(1.06) scaleY(1.08) rotate(3deg); }
        }

        @keyframes forge-tile-flame-left {
          0% { transform: translateX(1px) scaleX(0.9) scaleY(0.95) rotate(5deg); }
          100% { transform: translateX(-2px) scaleX(1.08) scaleY(1.06) rotate(-4deg); }
        }

        @keyframes forge-tile-flame-right {
          0% { transform: translateX(-2px) scaleX(0.92) scaleY(0.95) rotate(-5deg); }
          100% { transform: translateX(2px) scaleX(1.08) scaleY(1.06) rotate(5deg); }
        }

        @keyframes forge-tile-flame-core {
          0% { transform: translateY(1px) scaleX(0.88) scaleY(0.9); opacity: 0.88; }
          100% { transform: translateY(-2px) scaleX(1.08) scaleY(1.12); opacity: 1; }
        }

        @keyframes forge-tile-item-hit {
          0%, 100% { transform: translate(-50%, -48%) rotate(-4deg) scale(1); }
          16% { transform: translate(calc(-50% + 1px), calc(-48% + 1px)) rotate(-5deg) scale(0.98); }
          28% { transform: translate(calc(-50% - 1px), calc(-48% - 1px)) rotate(-3deg) scale(1.04); }
          52% { transform: translate(-50%, -48%) rotate(-4deg) scale(1); }
        }

        @keyframes forge-tile-item-glow {
          0%, 100% { opacity: 0.48; transform: scale(0.92); }
          26% { opacity: 1; transform: scale(1.12); }
          58% { opacity: 0.62; transform: scale(0.98); }
        }

        @keyframes forge-tile-impact {
          0%, 10%, 100% { opacity: 0; transform: translate(-50%, -50%) rotate(-16deg) scaleX(0.24); }
          16% { opacity: 1; transform: translate(-50%, -50%) rotate(-16deg) scaleX(1); }
          30% { opacity: 0.34; transform: translate(-50%, -50%) rotate(-16deg) scaleX(0.72); }
        }

        @keyframes forge-tile-spray {
          0%, 9%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--sr)) scaleX(0.18);
          }
          14% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--sr)) scaleX(1.1);
          }
          68% {
            opacity: 0.92;
            transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--sr)) scaleX(0.78);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--sr)) scaleX(0.24);
          }
        }

        @keyframes forge-tile-spark-burst {
          0%, 11%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.62); }
          18% { opacity: 1; transform: translate(-50%, -50%) scale(0.9); }
          58% { opacity: 0.64; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.12); }
        }

        @keyframes forge-tile-spark {
          0% { opacity: 0; transform: translateY(0) translateX(0) scale(0.55); }
          12% { opacity: 1; }
          78% { opacity: 0.7; }
          100% { opacity: 0; transform: translateY(-3.3rem) translateX(0.42rem) scale(0.14); }
        }

        .forge-visual {
          position: relative;
          width: 8.25rem;
          height: 8.25rem;
          isolation: isolate;
          user-select: none;
          border-radius: 1.35rem;
          transform: translateZ(0);
        }

        .forge-visual__halo {
          position: absolute;
          inset: 0.05rem;
          border-radius: 1.5rem;
          background:
            radial-gradient(circle at 50% 62%, rgba(255, 111, 28, 0.5), transparent 42%),
            radial-gradient(circle at 50% 72%, rgba(255, 214, 118, 0.28), transparent 30%);
          opacity: 0;
          filter: blur(18px);
          z-index: -1;
          transition: opacity 220ms ease;
        }

        .forge-visual--active .forge-visual__halo {
          opacity: 1;
          animation: forge-halo 1.18s ease-in-out infinite;
        }

        .forge-visual__svg {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
          filter: drop-shadow(0 13px 16px rgba(0, 0, 0, 0.48));
          transition: filter 240ms ease;
        }

        .forge-visual--active .forge-visual__svg {
          filter:
            drop-shadow(0 13px 16px rgba(0, 0, 0, 0.5))
            drop-shadow(0 0 12px rgba(255, 116, 26, 0.42));
          animation: forge-breathe 1.05s ease-in-out infinite;
        }

        .forge-mouth-glow,
        .forge-outer-glow,
        .forge-fire,
        .forge-sparks {
          transition: opacity 220ms ease, transform 220ms ease;
        }

        .forge-mouth-glow {
          opacity: 0.12;
        }

        .forge-heat {
          opacity: 0.2;
          transform-origin: 50% 88%;
          transform-box: fill-box;
        }

        .forge-fire {
          opacity: 0;
          transform: translateY(13px) scale(0.58);
          transform-origin: 50% 100%;
          transform-box: fill-box;
        }

        .forge-sparks {
          opacity: 0;
          fill: #ffd166;
        }

        .forge-visual--active .forge-mouth-glow {
          opacity: 0.95;
          animation: forge-mouth-pulse 780ms ease-in-out infinite;
        }

        .forge-visual--active .forge-outer-glow {
          opacity: 0.28;
          animation: forge-shell-heat 1.2s ease-in-out infinite;
        }

        .forge-visual--active .forge-heat {
          opacity: 1;
          animation: forge-heat-roll 880ms ease-in-out infinite;
        }

        .forge-visual--active .forge-fire {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .forge-flame {
          transform-origin: 50% 100%;
          transform-box: fill-box;
          will-change: transform;
          mix-blend-mode: screen;
        }

        .forge-visual--active .forge-flame--back {
          animation: forge-flame-tall 560ms ease-in-out infinite alternate;
        }

        .forge-visual--active .forge-flame--left {
          animation: forge-flame-left 430ms ease-in-out infinite alternate;
        }

        .forge-visual--active .forge-flame--right {
          animation: forge-flame-right 510ms ease-in-out infinite alternate;
        }

        .forge-visual--active .forge-flame--core {
          animation: forge-flame-core 360ms ease-in-out infinite alternate;
        }

        .forge-embers {
          opacity: 0.38;
        }

        .forge-visual--active .forge-embers {
          opacity: 1;
          animation: forge-ember-glow 720ms ease-in-out infinite alternate;
        }

        .forge-visual--active .forge-sparks {
          opacity: 1;
        }

        .forge-sparks circle {
          transform-origin: center;
          transform-box: fill-box;
          opacity: 0;
        }

        .forge-visual--active .forge-sparks circle:nth-child(1) { animation: forge-spark 1.15s linear infinite; }
        .forge-visual--active .forge-sparks circle:nth-child(2) { animation: forge-spark 1.15s 180ms linear infinite; }
        .forge-visual--active .forge-sparks circle:nth-child(3) { animation: forge-spark 1.15s 360ms linear infinite; }
        .forge-visual--active .forge-sparks circle:nth-child(4) { animation: forge-spark 1.15s 540ms linear infinite; }
        .forge-visual--active .forge-sparks circle:nth-child(5) { animation: forge-spark 1.15s 720ms linear infinite; }

        .forge-rivets circle {
          fill: #100a08;
          stroke: rgba(255, 205, 132, 0.35);
          stroke-width: 1;
        }

        .forge-visual--active .forge-rivets circle {
          fill: #331308;
          stroke: rgba(255, 178, 82, 0.72);
        }

        .forge-workpiece {
          position: absolute;
          right: 0.42rem;
          top: 0.42rem;
          z-index: 2;
          min-width: 1.95rem;
          height: 1.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.62rem;
          background:
            radial-gradient(circle at 35% 20%, rgba(255, 220, 135, 0.16), transparent 42%),
            rgba(5, 4, 4, 0.76);
          border: 1px solid rgba(255, 204, 130, 0.22);
          box-shadow: 0 7px 16px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          font-size: 1.04rem;
        }

        .forge-visual--active .forge-workpiece {
          border-color: rgba(255, 189, 88, 0.62);
          box-shadow: 0 0 14px rgba(249, 115, 22, 0.36), 0 7px 16px rgba(0, 0, 0, 0.45);
          animation: forge-workpiece-pop 850ms ease-in-out infinite;
        }

        .forge-workpiece b {
          position: absolute;
          right: -0.2rem;
          bottom: -0.2rem;
          min-width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.78);
          color: #f6c35f;
          border: 1px solid rgba(246, 195, 95, 0.38);
          font-size: 0.58rem;
          line-height: 1;
        }

        @keyframes forge-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1px) scale(1.015); }
        }

        @keyframes forge-halo {
          0%, 100% { transform: scale(0.94); opacity: 0.62; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        @keyframes forge-mouth-pulse {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }

        @keyframes forge-shell-heat {
          0%, 100% { transform: scale(0.98); opacity: 0.18; }
          50% { transform: scale(1.03); opacity: 0.34; }
        }

        @keyframes forge-heat-roll {
          0%, 100% { transform: scaleX(0.96) scaleY(0.92); opacity: 0.8; }
          50% { transform: scaleX(1.08) scaleY(1.05); opacity: 1; }
        }

        @keyframes forge-flame-tall {
          0% { transform: translateX(-1px) scaleX(0.94) scaleY(0.92) rotate(-2deg); }
          100% { transform: translateX(2px) scaleX(1.07) scaleY(1.08) rotate(3deg); }
        }

        @keyframes forge-flame-left {
          0% { transform: translateX(1px) scaleX(0.9) scaleY(0.96) rotate(5deg); }
          100% { transform: translateX(-2px) scaleX(1.08) scaleY(1.05) rotate(-4deg); }
        }

        @keyframes forge-flame-right {
          0% { transform: translateX(-2px) scaleX(0.92) scaleY(0.95) rotate(-5deg); }
          100% { transform: translateX(2px) scaleX(1.08) scaleY(1.06) rotate(5deg); }
        }

        @keyframes forge-flame-core {
          0% { transform: translateY(1px) scaleX(0.88) scaleY(0.9); opacity: 0.88; }
          100% { transform: translateY(-2px) scaleX(1.08) scaleY(1.1); opacity: 1; }
        }

        @keyframes forge-ember-glow {
          0% { filter: brightness(0.75); transform: translateY(0); }
          100% { filter: brightness(1.35); transform: translateY(-1px); }
        }

        @keyframes forge-spark {
          0% { opacity: 0; transform: translateY(0) translateX(0) scale(0.55); }
          12% { opacity: 1; }
          75% { opacity: 0.75; }
          100% { opacity: 0; transform: translateY(-29px) translateX(7px) scale(0.16); }
        }

        @keyframes forge-workpiece-pop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
      `}</style>
    </div>
  );
}
