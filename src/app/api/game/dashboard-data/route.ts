import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const [profileRes, skillRes, masteryRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mining_skills").select("*").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("mine_masteries").select("*").eq("user_id", user.id).eq("slot", slot),
  ]);

  return NextResponse.json({
    profile: profileRes.data ?? null,
    miningSkill: skillRes.data ?? null,
    masteries: masteryRes.data ?? [],
  });
}
