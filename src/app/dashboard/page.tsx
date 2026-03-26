export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Profile, MiningSkill, MineMastery, InventoryItem, IdleSession } from "@/lib/types";
import { melvorXpForLevel } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

// Cultivation stage names for 練體 1-9
const STAGE_NAMES: Record<number, string> = {
  1: "練體一階",
  2: "練體二階",
  3: "練體三階",
  4: "練體四階",
  5: "練體五階",
  6: "練體六階",
  7: "練體七階",
  8: "練體八階",
  9: "練體九階",
};

function getStageName(stage: number): string {
  return STAGE_NAMES[stage] ?? `練體${stage}階`;
}

function getXpForNextStage(stage: number): number {
  // Use Melvor XP curve for stage progression
  // Each stage maps to a level in the XP curve
  return melvorXpForLevel(stage + 1) - melvorXpForLevel(stage);
}

interface OfflineRewards {
  minutesAway: number;
  drops: { item_type: string; quantity: number }[];
  xpGained: {
    mining: number;
    mastery: number;
    body: number;
  };
  bodyProgress: string;
}

function calculateOfflineRewards(
  session: IdleSession | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _profile: Profile
): OfflineRewards | null {
  if (!session || !session.started_at) return null;

  const lastActive = new Date(session.ended_at ?? session.started_at).getTime();
  const now = Date.now();
  const minutesAway = Math.floor((now - lastActive) / 60_000);

  // Only show offline rewards if at least 1 minute has passed
  if (minutesAway < 1) return null;

  // Cap at 24 hours (1440 minutes)
  const effectiveMinutes = Math.min(minutesAway, 1440);
  // Actions: 1 per 3 seconds = 20 per minute
  const totalActions = effectiveMinutes * 20;

  // Simulate drops (using average from loot table: 煤 50%, 銅礦 35%, 靈石碎片 15%)
  const drops = [
    { item_type: "煤", quantity: Math.floor(totalActions * 0.5) },
    { item_type: "銅礦", quantity: Math.floor(totalActions * 0.35) },
    { item_type: "靈石碎片", quantity: Math.floor(totalActions * 0.15) },
  ].filter((d) => d.quantity > 0);

  // Estimate XP gained (using placeholder values per action)
  const xpPerAction = 5;
  const xpGained = {
    mining: totalActions * xpPerAction,
    mastery: totalActions * Math.floor(xpPerAction * 0.8),
    body: totalActions * Math.floor(xpPerAction * 0.6),
  };

  return {
    minutesAway: effectiveMinutes,
    drops,
    xpGained,
    bodyProgress: `+${xpGained.body} 練體經驗`,
  };
}

export default async function DashboardPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  let profile: Profile;
  let miningSkill: MiningSkill;
  let masteries: MineMastery[];
  let inventory: InventoryItem[];
  let latestSession: IdleSession | null;

  if (isDemo) {
    // Demo mode: provide mock data so the page renders without Supabase
    const demoId = "demo-user";
    profile = {
      id: demoId,
      user_id: demoId,
      cultivation_stage: 1,
      body_xp: 0,
      body_skill_level: 1,
      body_skill_xp: 0,
      inventory_slots: 20,
      created_at: new Date().toISOString(),
    };
    miningSkill = {
      id: "",
      user_id: demoId,
      level: 1,
      xp: 0,
      created_at: new Date().toISOString(),
    };
    masteries = [];
    inventory = [];
    latestSession = null;
  } else {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // Fetch player data in parallel
    const [profileRes, miningSkillRes, masteryRes, inventoryRes, sessionRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("mining_skills")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("mine_masteries")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("inventory_items")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("idle_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    // Default profile for new players
    profile = (profileRes.data as Profile) ?? {
      id: user.id,
      user_id: user.id,
      cultivation_stage: 1,
      body_xp: 0,
      body_skill_level: 1,
      body_skill_xp: 0,
      inventory_slots: 20,
      created_at: new Date().toISOString(),
    };

    miningSkill = (miningSkillRes.data as MiningSkill) ?? {
      id: "",
      user_id: user.id,
      level: 1,
      xp: 0,
      created_at: new Date().toISOString(),
    };

    masteries = (masteryRes.data as MineMastery[]) ?? [];

    inventory = (inventoryRes.data as InventoryItem[]) ?? [];

    latestSession = (sessionRes.data as IdleSession[])?.[0] ?? null;
  }

  // Calculate offline rewards
  const offlineRewards = calculateOfflineRewards(latestSession, profile);

  // Calculate XP progress
  const xpForNext = getXpForNextStage(profile.cultivation_stage);
  const xpProgress = xpForNext > 0 ? Math.min((profile.body_xp / xpForNext) * 100, 100) : 0;
  const isBreakthroughReady = xpProgress >= 100 && profile.cultivation_stage <= 9;

  // Calculate inventory usage
  const slotsUsed = inventory.length;
  const totalSlots = profile.inventory_slots;

  return (
    <DashboardClient
      profile={profile}
      miningSkill={miningSkill}
      masteries={masteries}
      inventory={inventory}
      offlineRewards={offlineRewards}
      stageName={getStageName(profile.cultivation_stage)}
      xpProgress={xpProgress}
      xpCurrent={profile.body_xp}
      xpRequired={xpForNext}
      isBreakthroughReady={isBreakthroughReady}
      slotsUsed={slotsUsed}
      totalSlots={totalSlots}
      isPostBodyTempering={profile.cultivation_stage > 9}
      bodySkillLevel={profile.body_skill_level}
    />
  );
}
