"use client";

import { useState, useEffect } from "react";
import { ShopClient } from "./shop-client";

export default function ShopPageWrapper() {
  const [spiritStones, setSpiritStones] = useState(0);
  const [currentSlots, setCurrentSlots] = useState(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game/shop-data")
      .then((r) => r.json())
      .then((data) => {
        setSpiritStones(data.spiritStones ?? 0);
        setCurrentSlots(data.currentSlots ?? 20);
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

  return <ShopClient spiritStones={spiritStones} currentSlots={currentSlots} />;
}
