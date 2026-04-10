// POST /api/game/heartbeat — update profile.last_seen_at for current slot
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("slot", slot);

  return NextResponse.json({ ok: true });
}
