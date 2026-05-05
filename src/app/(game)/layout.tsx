export const dynamic = "force-dynamic";

import { GameLayout } from "@/components/game-layout";
import { MiningProvider } from "@/components/mining-provider";
import { SingleTabGuard } from "@/components/single-tab-guard";
import { GlobalGameUI } from "@/components/global-game-ui";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import type { MiningSkill, MineMastery, InventoryItem, Profile } from "@/lib/types";
import { melvorXpForLevel, totalMiningXpForLevel, miningXpForLevel } from "@/lib/types";
import type { OfflineRewardResult } from "@/lib/offline-rewards";

export default async function GameGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemo = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  let miningStatus = { isMining: false, mineId: null as string | null };
  let initialState: Record<string, unknown> = {};
  let isMeditatingInit = false;
  let isEnlighteningInit = false;
  let enlightenmentTargetInit: { kind: "book"; item_type: string } | { kind: "technique"; technique_slug: string } | null = null;
  let combatInit: { monsterId: string } | null = null;
  let isSmithingInit = false;
  let smithingRecipeIdInit: string | null = null;
  let offlineRewardsInit: OfflineRewardResult | null = null;
  let isAdmin = false;
  let authSlot: number | undefined;

  if (isDemo) {
    const demoUserId = "demo-user";
    const demoInventory = [
      ["coal", 500],
      ["charcoal", 20],
      ["spirit_stone_fragment", 120],
      ["fire_crystal", 3],
      ["copper_ore", 99],
      ["tin_ore", 99],
      ["iron_ore", 99],
      ["silver_ore", 99],
      ["copper_bar", 60],
      ["tin_bar", 60],
      ["iron_bar", 60],
      ["silver_bar", 60],
      ["copper_sword", 1],
      ["copper_shield", 1],
      ["copper_helmet", 1],
      ["copper_chest", 1],
    ].map(([item_type, quantity], idx) => ({
      id: `demo-smithing-${idx}`,
      user_id: demoUserId,
      slot: 1,
      item_type: item_type as string,
      quantity: quantity as number,
      created_at: "",
    })) as InventoryItem[];

    authSlot = 1;
    initialState = {
      miningLevel: 80,
      miningXp: 0,
      miningXpMax: miningXpForLevel(80),
      masteryLevels: {},
      masteryXps: {},
      masteryXpMaxs: {},
      bodyStage: 10,
      bodyXp: 0,
      bodyLevel: 10,
      realm: "煉體",
      isMeditating: false,
      qiXp: 0,
      qiArray: [null, null, null, null, null],
      equipmentSets: { "1": {}, "2": {} },
      activeEquipmentSet: 1,
      equipment: {},
      lootBox: [],
      consumableSlots: [null, null, null],
      userPreferences: {},
      furnaceHeat: 1000,
      isSmithing: false,
      smithingRecipeId: null,
      smithingLevel: 80,
      smithingXp: 0,
      combatMonsterId: null,
      isEnlightening: false,
      enlightenmentTarget: null,
      offlineRewards: null,
      inventory: demoInventory,
      rockHpMap: {},
      rockDepletedAtMap: {},
      rockLastActiveMap: {},
    };
  } else {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId && user.id === adminId) isAdmin = true;
        const cookieStore = await cookies();
        const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);
        authSlot = slot;

        const [latestSessionRes, profileRes, skillRes, masteryRes, inventoryRes, mineRes, rockStateRes, smithingSkillRes] = await Promise.all([
          supabase.from("idle_sessions").select("type,mine_id,started_at,ended_at,last_sync_at,payload").eq("user_id", user.id).eq("slot", slot).is("ended_at", null).maybeSingle(),
          supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
          supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
          supabase.from("mines").select("id, slug, xp_mining, xp_mastery, xp_body").limit(10),
          supabase.from("mine_rock_state").select("mine_id, current_hp, depleted_at, last_active_at").eq("user_id", user.id).eq("slot", slot),
          supabase.from("smithing_skills").select("level, xp").eq("user_id", user.id).eq("slot", slot).maybeSingle(),
        ]);

        // Only resume an activity if the latest session has ended_at = NULL
        const latestSession = latestSessionRes.data;
        const sessionRes = latestSession && !latestSession.ended_at && latestSession.type === "mining"
          ? { data: { mine_id: latestSession.mine_id } }
          : { data: null as { mine_id: string } | null };

        if (latestSession && !latestSession.ended_at && latestSession.type === "meditate") {
          isMeditatingInit = true;
        }
        if (latestSession && !latestSession.ended_at && latestSession.type === "enlightenment" && latestSession.payload) {
          isEnlighteningInit = true;
          const p = latestSession.payload as { kind?: string; item_type?: string; technique_slug?: string };
          if (p.kind === "book" && p.item_type) {
            enlightenmentTargetInit = { kind: "book", item_type: p.item_type };
          } else if (p.kind === "technique" && p.technique_slug) {
            enlightenmentTargetInit = { kind: "technique", technique_slug: p.technique_slug };
          }
        }
        if (latestSession && !latestSession.ended_at && latestSession.type === "combat" && latestSession.payload) {
          const p = latestSession.payload as { monster_id?: string };
          if (p.monster_id) combatInit = { monsterId: p.monster_id };
        }
        if (latestSession && !latestSession.ended_at && latestSession.type === "smithing" && latestSession.payload) {
          const p = latestSession.payload as { recipe_id?: string };
          if (p.recipe_id) {
            isSmithingInit = true;
            smithingRecipeIdInit = p.recipe_id;
          }
        }

        // SSR offline rewards — computed once per page load, optimistic lock prevents double-award
        // Uses service-role client to bypass RLS (anon client can no longer write game tables)
        if (latestSession && !latestSession.ended_at) {
          const { computeOfflineRewards } = await import("@/lib/offline-rewards");
          const { createServiceSupabaseClient } = await import("@/lib/supabase-server");
          const serviceDb = createServiceSupabaseClient();
          offlineRewardsInit = await computeOfflineRewards(serviceDb, user.id, slot);
          // If combat resulted in death, clear combatInit so client doesn't auto-resume
          if (offlineRewardsInit?.combat?.died) {
            combatInit = null;
          }
        }

        if (sessionRes.data?.mine_id) {
          miningStatus = { isMining: true, mineId: sessionRes.data.mine_id };
        }

        const profile = profileRes.data as Profile | null;
        const skill = skillRes.data as MiningSkill | null;
        const masteries = (masteryRes.data as MineMastery[]) ?? [];
        const inventory = (inventoryRes.data as InventoryItem[]) ?? [];
        const minesData = (mineRes.data as { id: string; slug: string; xp_mining: number; xp_mastery: number; xp_body: number; main_drop: string; companion_drops: { item: string; chance: number }[]; rock_base_hp: number; respawn_seconds: number }[]) ?? [];

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

        // Pass rock states to frontend for live HP computation (regen + respawn)
        const rockHpMap: Record<string, number> = {};
        const rockDepletedAtMap: Record<string, string | null> = {};
        const rockLastActiveMap: Record<string, string> = {};
        const rockStates = (rockStateRes.data as { mine_id: string; current_hp: number; depleted_at: string | null; last_active_at: string }[] | null) ?? [];
        for (const rs of rockStates) {
          // Store raw current_hp (not regen'd) — frontend computes live HP each render
          rockHpMap[rs.mine_id] = rs.current_hp;
          rockDepletedAtMap[rs.mine_id] = rs.depleted_at;
          rockLastActiveMap[rs.mine_id] = rs.last_active_at;
        }

        initialState = {
          miningLevel: level,
          miningXp: totalXp - totalMiningXpForLevel(level),
          miningXpMax: miningXpForLevel(level),
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
          consumableSlots: (profile?.consumable_slots as (string | null)[] | null) ?? [null, null, null],
          userPreferences: (profile as unknown as { user_preferences?: Record<string, unknown> })?.user_preferences ?? {},
          furnaceHeat: profile?.furnace_heat ?? 0,
          isSmithing: isSmithingInit,
          smithingRecipeId: smithingRecipeIdInit,
          smithingLevel: smithingSkillRes.data?.level ?? 1,
          smithingXp: (smithingSkillRes.data?.xp ?? 0) - totalMiningXpForLevel(smithingSkillRes.data?.level ?? 1),
          combatMonsterId: combatInit?.monsterId ?? null,
          isEnlightening: isEnlighteningInit,
          enlightenmentTarget: enlightenmentTargetInit,
          offlineRewards: offlineRewardsInit,
          inventory,
          rockHpMap,
          rockDepletedAtMap,
          rockLastActiveMap,
          activeMine: activeMineData ? {
            id: activeMineData.id,
            slug: activeMineData.slug,
            xp_mining: activeMineData.xp_mining,
            xp_mastery: activeMineData.xp_mastery,
            xp_body: activeMineData.xp_body,
            main_drop: activeMineData.main_drop ?? "coal",
            companion_drops: activeMineData.companion_drops ?? [],
            rock_base_hp: activeMineData.rock_base_hp ?? 1,
            respawn_seconds: activeMineData.respawn_seconds ?? 5,
          } : undefined,
        };
      }
    } catch {
      // ignore
    }
  }

  return (
    <SingleTabGuard>
      <MiningProvider slot={authSlot} initialStatus={miningStatus} initialState={initialState}>
        <GlobalGameUI />
        <GameLayout isAdmin={isAdmin}>{children}</GameLayout>

      </MiningProvider>
    </SingleTabGuard>
  );
}
