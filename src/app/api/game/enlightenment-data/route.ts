import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const [profileRes, techniquesRes] = await Promise.all([
    supabase.from("profiles").select("enlightenment_xp, enlightenment_level").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("player_techniques").select("technique_slug, mastery_level, mastery_xp").eq("user_id", user.id).eq("slot", slot),
  ]);

  return NextResponse.json({
    enlightenmentXp: (profileRes.data?.enlightenment_xp as number) ?? 0,
    enlightenmentLevel: (profileRes.data?.enlightenment_level as number) ?? 1,
    learnedTechniques: techniquesRes.data ?? [],
  });
}
