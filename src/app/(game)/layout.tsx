export const dynamic = "force-dynamic";

import { GameLayout } from "@/components/game-layout";
import { MiningProvider } from "@/components/mining-provider";
import { SingleTabGuard } from "@/components/single-tab-guard";
import { GlobalGameUI } from "@/components/global-game-ui";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import type { MiningSkill, MineMastery, InventoryItem, Profile } from "@/lib/types";
import { melvorXpForLevel } from "@/lib/types";
import type { OfflineRewardResult } from "@/lib/offline-rewards";

export default async function GameGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  let miningStatus = { isMining: false, mineId: null as string | null };
  let initialState: Record<string, unknown> = {};
  let isMeditatingInit = false;
  let offlineRewardsInit: OfflineRewardResult | null = null;
  let isAdmin = false;

  if (!isDemo) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId && user.id === adminId) isAdmin = true;
        const cookieStore = await cookies();
        const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

        const [latestSessionRes, profileRes, skillRes, masteryRes, inventoryRes, mineRes] = await Promise.all([
          supabase.from("idle_sessions").select("type,mine_id,started_at,ended_at,last_sync_at,payload").eq("user_id", user.id).eq("slot", slot).is("ended_at", null).maybeSingle(),
          supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("mines").select("id, slug, xp_mining, xp_mastery, xp_body").limit(10),
        ]);

        // Only resume an activity if the latest session has ended_at = NULL
        const latestSession = latestSessionRes.data;
        const sessionRes = latestSession && !latestSession.ended_at && latestSession.type === "mining"
          ? { data: { mine_id: latestSession.mine_id } }
          : { data: null as { mine_id: string } | null };

        if (latestSession && !latestSession.ended_at && latestSession.type === "meditate") {
          isMeditatingInit = true;
        }

        // Offline rewards now computed via client-triggered API (mount + visibility).
        // SSR path removed to avoid double-award on internal navigation.

        if (sessionRes.data?.mine_id) {
          miningStatus = { isMining: true, mineId: sessionRes.data.mine_id };
        }

        const profile = profileRes.data as Profile | null;
        const skill = skillRes.data as MiningSkill | null;
        const masteries = (masteryRes.data as MineMastery[]) ?? [];
        const inventory = (inventoryRes.data as InventoryItem[]) ?? [];
        const minesData = (mineRes.data as { id: string; slug: string; xp_mining: number; xp_mastery: number; xp_body: number }[]) ?? [];

        const level = skill?.level ?? 1;
        const totalXp = skill?.xp ?? 0;

        const masteryLevels: Record<string, number> = {};
        const masteryXps: Record<string, number> = {};
        const masteryXpMaxs: Record<string, number> = {};
        for (const m of masteries) {
          masteryLevels[m.mine_id] = m.level;
          masteryXps[m.mine_id] = m.xp - melvorXpForLevel(m.level);
          masteryXpMaxs[m.mine_id] = melvorXpForLevel(m.level + 1) - melvorXpForLevel(m.level);
        }

        // Find active mine data for the provider
        const activeMineData = minesData.find((m) => m.id === sessionRes.data?.mine_id);

        initialState = {
          miningLevel: level,
          miningXp: totalXp - melvorXpForLevel(level),
          miningXpMax: melvorXpForLevel(level + 1) - melvorXpForLevel(level),
          masteryLevels,
          masteryXps,
          masteryXpMaxs,
          bodyStage: profile?.body_level ?? profile?.realm_level ?? profile?.cultivation_stage ?? 1,
          bodyXp: profile?.body_xp ?? 0,
          realm: profile?.realm ?? "煉體",
          isMeditating: isMeditatingInit,
          qiXp: profile?.qi_xp ?? 0,
          qiArray: (profile?.qi_array as (string | null)[] | null) ?? [null, null, null, null, null],
          equipmentSets: profile?.equipment_sets ?? { "1": {}, "2": {} },
          activeEquipmentSet: profile?.active_equipment_set ?? 1,
          equipment: (profile?.equipment_sets ?? {})[String(profile?.active_equipment_set ?? 1)] ?? {},
          bodyLevel: profile?.body_level ?? 1,
          lootBox: profile?.loot_box ?? [],
          offlineRewards: offlineRewardsInit,
          inventory,
          activeMine: activeMineData ? {
            id: activeMineData.id,
            slug: activeMineData.slug,
            xp_mining: activeMineData.xp_mining,
            xp_mastery: activeMineData.xp_mastery,
            xp_body: activeMineData.xp_body,
          } : undefined,
        };
      }
    } catch {
      // ignore
    }
  }

  return (
    <SingleTabGuard>
      <MiningProvider initialStatus={miningStatus} initialState={initialState}>
        <GlobalGameUI />
        <GameLayout isAdmin={isAdmin}>{children}</GameLayout>
      </MiningProvider>
    </SingleTabGuard>
  );
}
