"use client";

import { useState, useEffect } from "react";
import { useGameState } from "@/components/mining-provider";
import { MiningPageClient } from "./mining-page-client";
import type { MineInfo } from "./page";

export default function MiningPageWrapper() {
  const gameState = useGameState();
  const [mines, setMines] = useState<MineInfo[]>([]);
  const [inventorySlots, setInventorySlots] = useState(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game/mining-data")
      .then((r) => r.json())
      .then((data) => {
        setMines(data.mines ?? []);
        setInventorySlots(data.inventorySlots ?? 20);
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

  return (
    <MiningPageClient
      mines={mines}
      miningLevel={gameState.miningLevel}
      miningXp={gameState.miningXp}
      miningXpMax={gameState.miningXpMax}
      masteryLevels={gameState.masteryLevels}
      masteryXps={gameState.masteryXps}
      masteryXpMaxs={gameState.masteryXpMaxs}
      inventory={gameState.inventory}
      inventorySlots={inventorySlots}
      bodyStage={gameState.bodyStage}
      bodyXp={gameState.bodyXp}
      activeMineId={gameState.activeMineId}
      isDemo={false}
    />
  );
}
