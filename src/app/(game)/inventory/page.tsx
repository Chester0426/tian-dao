"use client";

import { useGameState } from "@/components/mining-provider";
import { InventoryClient } from "./inventory-client";

export default function InventoryPage() {
  const gameState = useGameState();

  return (
    <InventoryClient
      inventory={gameState.inventory}
      totalSlots={20}
      daoPoints={0}
    />
  );
}
