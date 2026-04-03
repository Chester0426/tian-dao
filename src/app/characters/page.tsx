export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";
import { CharactersClient } from "./characters-client";

const STAGE_NAMES: Record<number, string> = {
  1: "煉體一階", 2: "煉體二階", 3: "煉體三階",
  4: "煉體四階", 5: "煉體五階", 6: "煉體六階",
  7: "煉體七階", 8: "煉體八階", 9: "煉體九階",
  10: "練氣一階",
};

export interface SlotData {
  slot: number;
  profile: Profile | null;
  miningLevel: number;
  lastPlayed: string | null;
  lastActivity: string | null; // "mining" or null — determines where to redirect on load
  lastMineSlug: string | null; // slug of the mine being mined
}

export default async function CharactersPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    // Demo mode: show one character in slot 1
    const demoSlots: SlotData[] = [
      {
        slot: 1,
        profile: {
          id: "demo", user_id: "demo", slot: 1,
          realm: "煉體" as const, realm_level: 1, cultivation_stage: 1,
          body_level: 1, body_xp: 0,
          qi_level: 0, qi_xp: 0, foundation_level: 0, foundation_xp: 0,
          core_level: 0, core_xp: 0, nascent_level: 0, nascent_xp: 0,
          body_skill_level: 1, body_skill_xp: 0,
          inventory_slots: 20, dao_points: 0, created_at: new Date().toISOString(),
        },
        miningLevel: 1,
        lastPlayed: new Date().toISOString(),
        lastActivity: null,
        lastMineSlug: null,
      },
      { slot: 2, profile: null, miningLevel: 0, lastPlayed: null, lastActivity: null, lastMineSlug: null },
      { slot: 3, profile: null, miningLevel: 0, lastPlayed: null, lastActivity: null, lastMineSlug: null },
    ];
    return <CharactersClient slots={demoSlots} stageNames={STAGE_NAMES} walletAddress={null} />;
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all profiles for this user (up to 3 slots)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("slot", { ascending: true });

  // Fetch mining skills for all slots
  const { data: miningSkills } = await supabase
    .from("mining_skills")
    .select("slot, level")
    .eq("user_id", user.id);

  // Fetch latest session timestamps and mines
  const [sessionsRes, minesRes] = await Promise.all([
    supabase.from("idle_sessions").select("slot, type, mine_id, started_at, ended_at").eq("user_id", user.id),
    supabase.from("mines").select("id, slug"),
  ]);
  const sessions = sessionsRes.data;
  const minesData = minesRes.data as { id: string; slug: string }[] | null;

  // Build slot data for all 3 slots
  const slots: SlotData[] = [1, 2, 3].map((slot) => {
    const profile = (profiles as Profile[] | null)?.find((p) => p.slot === slot) ?? null;
    const skill = miningSkills?.find((s: { slot: number; level: number }) => s.slot === slot);
    const session = sessions?.find((s: { slot: number }) => s.slot === slot);
    const lastPlayed = session
      ? (session as { ended_at: string | null; started_at: string }).ended_at ?? (session as { started_at: string }).started_at
      : profile?.created_at ?? null;

    return {
      slot,
      profile,
      miningLevel: skill?.level ?? 0,
      lastPlayed,
      lastActivity: session ? (session as { type: string }).type : null,
      lastMineSlug: session ? minesData?.find((m) => m.id === (session as { mine_id: string }).mine_id)?.slug ?? null : null,
    };
  });

  // Fetch wallet binding
  const { data: walletBinding } = await supabase
    .from("wallet_bindings")
    .select("wallet_address")
    .eq("user_id", user.id)
    .single();

  return <CharactersClient slots={slots} stageNames={STAGE_NAMES} walletAddress={walletBinding?.wallet_address ?? null} />;
}
