// POST /api/game/offline-rewards — Calculate and apply offline progress
import { NextRequest, NextResponse } from "next/server";
import { computeOfflineRewards } from "@/lib/offline-rewards";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const result = await verifyProfile(request);
  if ("error" in result) return result.error;
  const { user, slot, supabase } = result;

  const reward = await computeOfflineRewards(supabase, user.id, slot);
  if (!reward) {
    return NextResponse.json({ message: "No offline reward" }, { status: 200 });
  }
  return NextResponse.json({
    minutes_away: reward.minutes_away,
    session_type: reward.session_type,
    drops: reward.drops,
    xp_gained: reward.xp_gained,
  });
}
