export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Profile, MiningSkill, MineMastery, InventoryItem } from "@/lib/types";
import { MiningPageClient } from "./mining-page-client";

export interface MineInfo {
  id: string;
  name: string;
  name_zh?: string;
  name_en?: string;
  slug: string;
  required_level: number;
  rock_base_hp: number;
  respawn_seconds: number;
  xp_mining: number;
  xp_mastery: number;
  xp_body: number;
  main_drop: string;
  companion_drops: { item: string; chance: number }[];
}

export default async function MiningPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    return (
      <MiningPageClient
        mines={[{
          id: "demo", name: "Coal Mine", name_zh: "煤礦場", name_en: "Coal Mine", slug: "coal_mine",
          required_level: 1, rock_base_hp: 1, respawn_seconds: 5,
          xp_mining: 5, xp_mastery: 3, xp_body: 5,
          main_drop: "coal", companion_drops: [{ item: "spirit_stone_fragment", chance: 0.01 }],
        }]}
        miningLevel={1}
        miningXp={0}
        miningXpMax={83}
        masteryLevels={{}}
        masteryXps={{}}
        masteryXpMaxs={{}}
        inventory={[]}
        inventorySlots={20}
        bodyStage={1}
        bodyXp={0}
        activeMineId={null}
        isDemo={true}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  const [minesRes, profileRes, skillRes, masteryRes, inventoryRes, sessionRes] = await Promise.all([
    supabase.from("mines").select("*").order("required_level", { ascending: true }),
    supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("idle_sessions").select("mine_id").eq("user_id", user.id).eq("slot", slot).eq("type", "mining").single(),
  ]);

  const mines = (minesRes.data ?? []) as MineInfo[];
  const profile = profileRes.data as Profile | null;
  const skill = skillRes.data as MiningSkill | null;
  const masteries = (masteryRes.data as MineMastery[]) ?? [];
  const inventory = (inventoryRes.data as InventoryItem[]) ?? [];

  const { melvorXpForLevel } = await import("@/lib/types");
  const level = skill?.level ?? 1;
  const totalXp = skill?.xp ?? 0;
  const xpInLevel = totalXp - melvorXpForLevel(level);
  const xpForNext = melvorXpForLevel(level + 1) - melvorXpForLevel(level);

  // Build mastery maps: mine_id → { level, xp, xpMax }
  const masteryLevels: Record<string, number> = {};
  const masteryXps: Record<string, number> = {};
  const masteryXpMaxs: Record<string, number> = {};
  for (const m of masteries) {
    masteryLevels[m.mine_id] = m.level;
    const totalXpM = m.xp;
    masteryXps[m.mine_id] = totalXpM - melvorXpForLevel(m.level);
    masteryXpMaxs[m.mine_id] = melvorXpForLevel(m.level + 1) - melvorXpForLevel(m.level);
  }

  return (
    <MiningPageClient
      mines={mines}
      miningLevel={level}
      miningXp={xpInLevel}
      miningXpMax={xpForNext}
      masteryLevels={masteryLevels}
      masteryXps={masteryXps}
      masteryXpMaxs={masteryXpMaxs}
      inventory={inventory}
      inventorySlots={profile?.inventory_slots ?? 20}
      bodyStage={profile?.cultivation_stage ?? 1}
      bodyXp={profile?.body_xp ?? 0}
      activeMineId={sessionRes.data?.mine_id ?? null}
      isDemo={false}
    />
  );
}
