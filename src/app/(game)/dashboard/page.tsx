export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Profile, MiningSkill, MineMastery, InventoryItem, IdleSession, Realm } from "@/lib/types";
import { bodyXpForStage, getRealmLevelLabel } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

function getXpForNextLevel(level: number): number {
  return bodyXpForStage(level);
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

  if (minutesAway < 1) return null;

  const effectiveMinutes = Math.min(minutesAway, 720);
  const totalActions = effectiveMinutes * 20;

  const drops = [
    { item_type: "煤", quantity: Math.floor(totalActions * 0.5) },
    { item_type: "銅礦", quantity: Math.floor(totalActions * 0.35) },
    { item_type: "靈石碎片", quantity: Math.floor(totalActions * 0.15) },
  ].filter((d) => d.quantity > 0);

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
    bodyProgress: `+${xpGained.body} 煉體經驗`,
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
    const demoId = "demo-user";
    profile = {
      id: demoId,
      user_id: demoId,
      slot: 1,
      realm: "煉體", realm_level: 1, cultivation_stage: 1,
      body_level: 1, body_xp: 0,
      qi_level: 0, qi_xp: 0, foundation_level: 0, foundation_xp: 0,
      core_level: 0, core_xp: 0, nascent_level: 0, nascent_xp: 0,
      body_skill_level: 1, body_skill_xp: 0,
      inventory_slots: 20, dao_points: 0,
      created_at: new Date().toISOString(),
    };
    miningSkill = {
      id: "",
      user_id: demoId,
      slot: 1,
      level: 1,
      xp: 0,
      created_at: new Date().toISOString(),
    };
    masteries = [];
    inventory = [];
    latestSession = null;
  } else {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

    const [profileRes, miningSkillRes, masteryRes, inventoryRes, sessionRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
        supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
        supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
        supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
        supabase.from("idle_sessions").select("*").eq("user_id", user.id).eq("slot", slot).order("created_at", { ascending: false }).limit(1),
      ]);

    const rawProfile = profileRes.data as Record<string, unknown> | null;
    if (rawProfile) {
      profile = {
        ...rawProfile,
        realm: (rawProfile.realm as Realm) ?? "煉體",
        realm_level: (rawProfile.realm_level as number) ?? (rawProfile.cultivation_stage as number) ?? 1,
        body_level: (rawProfile.body_level as number) ?? (rawProfile.cultivation_stage as number) ?? 1,
        qi_level: (rawProfile.qi_level as number) ?? 0,
        qi_xp: (rawProfile.qi_xp as number) ?? 0,
        foundation_level: (rawProfile.foundation_level as number) ?? 0,
        foundation_xp: (rawProfile.foundation_xp as number) ?? 0,
        core_level: (rawProfile.core_level as number) ?? 0,
        core_xp: (rawProfile.core_xp as number) ?? 0,
        nascent_level: (rawProfile.nascent_level as number) ?? 0,
        nascent_xp: (rawProfile.nascent_xp as number) ?? 0,
      } as Profile;
    } else {
      // No profile for this slot — redirect to character selection
      redirect("/characters");
      profile = { // unreachable, for type safety
        id: user.id, user_id: user.id, slot,
        realm: "煉體" as Realm, realm_level: 1, cultivation_stage: 1,
        body_level: 1, body_xp: 0,
        qi_level: 0, qi_xp: 0, foundation_level: 0, foundation_xp: 0,
        core_level: 0, core_xp: 0, nascent_level: 0, nascent_xp: 0,
        body_skill_level: 1, body_skill_xp: 0,
        inventory_slots: 20, dao_points: 0,
        created_at: new Date().toISOString(),
      };
    }

    miningSkill = (miningSkillRes.data as MiningSkill) ?? {
      id: "", user_id: user.id, slot, level: 1, xp: 0, created_at: new Date().toISOString(),
    };
    masteries = (masteryRes.data as MineMastery[]) ?? [];
    inventory = (inventoryRes.data as InventoryItem[]) ?? [];
    latestSession = (sessionRes.data as IdleSession[])?.[0] ?? null;
  }

  const offlineRewards = calculateOfflineRewards(latestSession, profile);
  // Use the appropriate level/xp for current realm
  const currentRealmLevel = profile.realm === "煉體" ? profile.body_level : profile.realm_level;
  const currentRealmXp = profile.realm === "煉體" ? profile.body_xp : profile.body_xp;
  const xpForNext = getXpForNextLevel(currentRealmLevel);
  const xpProgress = xpForNext > 0 ? Math.min((profile.body_xp / xpForNext) * 100, 100) : 0;
  const isBreakthroughReady = xpProgress >= 100;

  const slotsUsed = inventory.length;
  const totalSlots = profile.inventory_slots;

  const stageName = `${profile.realm} ${getRealmLevelLabel(profile.realm, profile.realm_level)}`;

  return (
    <DashboardClient
      profile={profile}
      miningSkill={miningSkill}
      masteries={masteries}
      inventory={inventory}
      offlineRewards={offlineRewards}
      stageName={stageName}
      xpProgress={xpProgress}
      xpCurrent={profile.body_xp}
      xpRequired={xpForNext}
      isBreakthroughReady={isBreakthroughReady}
      slotsUsed={slotsUsed}
      totalSlots={totalSlots}
      isPostBodyTempering={profile.realm !== "煉體"}
      bodySkillLevel={profile.body_skill_level}
    />
  );
}
