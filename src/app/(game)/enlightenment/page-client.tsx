"use client";

import { useState, useEffect } from "react";
import { useGameState } from "@/components/mining-provider";
import { EnlightenmentClient } from "./enlightenment-client";

interface LearnedTechnique {
  technique_slug: string;
  mastery_level: number;
  mastery_xp: number;
}

export default function EnlightenmentPageWrapper() {
  const gameState = useGameState();
  const [enlightenmentXp, setEnlightenmentXp] = useState(0);
  const [enlightenmentLevel, setEnlightenmentLevel] = useState(1);
  const [learnedTechniques, setLearnedTechniques] = useState<LearnedTechnique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game/enlightenment-data")
      .then((r) => r.json())
      .then((data) => {
        setEnlightenmentXp(data.enlightenmentXp ?? 0);
        setEnlightenmentLevel(data.enlightenmentLevel ?? 1);
        setLearnedTechniques(data.learnedTechniques ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-muted-foreground animate-pulse">載入中…</span>
      </div>
    );
  }

  // Use live inventory from provider, fall back to empty
  const inventory = gameState.inventory.map((i) => ({
    item_type: i.item_type,
    quantity: i.quantity,
  }));

  return (
    <EnlightenmentClient
      enlightenmentXp={enlightenmentXp}
      enlightenmentLevel={enlightenmentLevel}
      learnedTechniques={learnedTechniques}
      inventory={inventory}
    />
  );
}
