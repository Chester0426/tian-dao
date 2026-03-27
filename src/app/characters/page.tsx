export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";
import { CharactersClient } from "./characters-client";

const STAGE_NAMES: Record<number, string> = {
  1: "練體一階", 2: "練體二階", 3: "練體三階",
  4: "練體四階", 5: "練體五階", 6: "練體六階",
  7: "練體七階", 8: "練體八階", 9: "練體九階",
};

export interface SlotData {
  slot: number;
  profile: Profile | null;
  miningLevel: number;
  lastPlayed: string | null;
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
          cultivation_stage: 1, body_xp: 0, body_skill_level: 1, body_skill_xp: 0,
          inventory_slots: 20, created_at: new Date().toISOString(),
        },
        miningLevel: 1,
        lastPlayed: new Date().toISOString(),
      },
      { slot: 2, profile: null, miningLevel: 0, lastPlayed: null },
      { slot: 3, profile: null, miningLevel: 0, lastPlayed: null },
    ];
    return <CharactersClient slots={demoSlots} stageNames={STAGE_NAMES} />;
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

  // Fetch latest session timestamps for each slot
  const { data: sessions } = await supabase
    .from("idle_sessions")
    .select("slot, started_at, ended_at")
    .eq("user_id", user.id);

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
    };
  });

  return <CharactersClient slots={slots} stageNames={STAGE_NAMES} />;
}
