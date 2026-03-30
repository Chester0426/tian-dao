export const dynamic = "force-dynamic";

import { GameLayout } from "@/components/game-layout";
import { MiningProvider } from "@/components/mining-provider";
import { SingleTabGuard } from "@/components/single-tab-guard";
import { OfflineRewardsChecker } from "@/components/offline-rewards-checker";
import { VisibilityRewardsDialog } from "@/components/visibility-rewards-dialog";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import type { MiningSkill, MineMastery, InventoryItem, Profile } from "@/lib/types";
import { melvorXpForLevel } from "@/lib/types";

export default async function GameGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  let miningStatus = { isMining: false, mineId: null as string | null };
  let initialState = {};

  if (!isDemo) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const cookieStore = await cookies();
        const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

        const [sessionRes, profileRes, skillRes, masteryRes, inventoryRes, mineRes] = await Promise.all([
          supabase.from("idle_sessions").select("mine_id").eq("user_id", user.id).eq("slot", slot).eq("type", "mining").single(),
          supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("mines").select("id, slug, xp_mining, xp_mastery, xp_body").limit(10),
        ]);

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
          bodyStage: profile?.cultivation_stage ?? 1,
          bodyXp: profile?.body_xp ?? 0,
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
        <OfflineRewardsChecker hasActiveSession={miningStatus.isMining} />
        <VisibilityRewardsDialog />
        <GameLayout>{children}</GameLayout>
      </MiningProvider>
    </SingleTabGuard>
  );
}
