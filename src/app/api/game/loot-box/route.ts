// GET /api/game/loot-box — read loot box (read-only, no client write)
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const { data: profile } = await supabase
    .from("profiles")
    .select("loot_box")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  return NextResponse.json({ loot_box: profile?.loot_box ?? [] });
}
