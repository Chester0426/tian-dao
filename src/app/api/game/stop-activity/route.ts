// POST /api/game/stop-activity — end active session via atomic RPC
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  await supabase.rpc("stop_activity", {
    p_user_id: user.id,
    p_slot: slot,
  });

  return NextResponse.json({ ok: true });
}
