export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Profile, MiningSkill, MineMastery, InventoryItem, Mine } from "@/lib/types";
import { MiningClient } from "./mining-client";

export default async function MiningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    return (
      <MiningClient
        mineId="demo"
        mineData={{
          id: "demo", name: "枯竭礦脈", slug: slug,
          required_level: 1, action_interval_ms: 3000,
          loot_table: [
            { item_type: "coal", probability: 0.5, xp_mining: 5, xp_mastery: 3, xp_body: 5 },
            { item_type: "copper_ore", probability: 0.35, xp_mining: 8, xp_mastery: 5, xp_body: 8 },
            { item_type: "spirit_stone_fragment", probability: 0.15, xp_mining: 15, xp_mastery: 10, xp_body: 15 },
          ],
          rock_base_hp: 1, respawn_seconds: 5,
          xp_mining: 5, xp_mastery: 3, xp_body: 5, created_at: "",
        }}
        initialProfile={{ id: "demo", user_id: "demo", slot: 1, cultivation_stage: 1, body_xp: 0, body_skill_level: 1, body_skill_xp: 0, inventory_slots: 20, dao_points: 0, created_at: "" }}
        initialMiningLevel={1}
        initialMasteryLevel={1}
        initialInventory={[]}
        isDemo={true}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  // Fetch mine data, player state, and idle session in parallel
  const [mineRes, profileRes, miningSkillRes, masteryRes, inventoryRes, sessionRes] = await Promise.all([
    supabase.from("mines").select("*").eq("slug", slug).single(),
    supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("idle_sessions").select("*").eq("user_id", user.id).eq("slot", slot).eq("type", "mining").single(),
  ]);

  const mine = mineRes.data as Mine | null;
  const profile = profileRes.data as Profile | null;
  const miningSkill = miningSkillRes.data as MiningSkill | null;
  const masteries = (masteryRes.data as MineMastery[]) ?? [];
  const inventory = (inventoryRes.data as InventoryItem[]) ?? [];
  const idleSession = sessionRes.data;

  if (!mine) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">礦場資料載入失敗</div>;
  }

  // Check if player was mining before (has an active session) → auto-start
  const hasActiveSession = !!idleSession;

  // Fetch offline rewards if returning after being away
  let offlineRewards = null;
  if (hasActiveSession) {
    try {
      const lastActive = new Date(idleSession.ended_at ?? idleSession.started_at).getTime();
      const minutesAway = Math.floor((Date.now() - lastActive) / 60_000);
      if (minutesAway >= 1) {
        const effectiveMinutes = Math.min(minutesAway, 720); // 12h cap
        const totalActions = effectiveMinutes * 20; // 1 per 3s = 20/min
        offlineRewards = {
          minutes_away: effectiveMinutes,
          total_actions: totalActions,
          drops: [
            { item_type: "coal", quantity: Math.floor(totalActions * 0.5) },
            { item_type: "copper_ore", quantity: Math.floor(totalActions * 0.35) },
            { item_type: "spirit_stone_fragment", quantity: Math.floor(totalActions * 0.15) },
          ].filter((d) => d.quantity > 0),
          xp_gained: {
            mining: totalActions * 5,
            mastery: totalActions * 3,
            body: totalActions * 5,
          },
        };
      }
    } catch {
      // ignore
    }
  }

  const mineWithInterval: Mine = { ...mine, action_interval_ms: 3000 };
  const depletedMastery = masteries.find((m) => m.mine_id === mine.id);

  return (
    <MiningClient
      mineId={mine.id}
      mineData={mineWithInterval}
      initialProfile={profile ?? { id: "", user_id: user.id, slot, cultivation_stage: 1, body_xp: 0, body_skill_level: 1, body_skill_xp: 0, inventory_slots: 20, dao_points: 0, created_at: "" }}
      initialMiningLevel={miningSkill?.level ?? 1}
      initialMasteryLevel={depletedMastery?.level ?? 1}
      initialInventory={inventory}
      isDemo={false}
      autoStart={hasActiveSession}
      offlineRewards={offlineRewards}
    />
  );
}
