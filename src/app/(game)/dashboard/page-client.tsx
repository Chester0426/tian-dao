"use client";

import { useState, useEffect } from "react";
import { useGameState } from "@/components/mining-provider";
import { DashboardClient } from "./dashboard-client";
import type { Profile, MiningSkill, MineMastery } from "@/lib/types";
import { bodyXpForStage, getRealmLevelLabel } from "@/lib/types";

export default function DashboardPageClient() {
  const gameState = useGameState();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [miningSkill, setMiningSkill] = useState<MiningSkill | null>(null);
  const [masteries, setMasteries] = useState<MineMastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game/dashboard-data")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile);
        setMiningSkill(data.miningSkill);
        setMasteries(data.masteries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-muted-foreground animate-pulse">載入中…</span>
      </div>
    );
  }

  // Merge live provider data into profile
  const liveProfile: Profile = {
    ...profile,
    realm: (gameState.realm as Profile["realm"]) ?? profile.realm,
    body_level: gameState.bodyStage ?? profile.body_level,
    body_xp: gameState.bodyXp ?? profile.body_xp,
  };

  const xpForNext = bodyXpForStage(liveProfile.body_level);
  const xpProgress = xpForNext > 0 ? Math.min((liveProfile.body_xp / xpForNext) * 100, 100) : 0;
  const isBreakthroughReady = xpProgress >= 100;
  const inventory = gameState.inventory.length > 0 ? gameState.inventory : [];
  const slotsUsed = inventory.length;
  const totalSlots = liveProfile.inventory_slots;
  const stageName = `${liveProfile.realm} ${getRealmLevelLabel(liveProfile.realm, liveProfile.realm_level)}`;

  return (
    <DashboardClient
      profile={liveProfile}
      miningSkill={miningSkill ?? { id: "", user_id: "", slot: 1, level: 1, xp: 0, created_at: "" }}
      masteries={masteries}
      inventory={inventory}
      offlineRewards={null}
      stageName={stageName}
      xpProgress={xpProgress}
      xpCurrent={liveProfile.body_xp}
      xpRequired={xpForNext}
      isBreakthroughReady={isBreakthroughReady}
      slotsUsed={slotsUsed}
      totalSlots={totalSlots}
      isPostBodyTempering={liveProfile.realm !== "煉體"}
      bodySkillLevel={liveProfile.body_skill_level}
    />
  );
}
