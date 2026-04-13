// GET /api/game/profile-data — return equipment and other profile data for client
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const { data: profile } = await supabase
    .from("profiles")
    .select("equipment, body_level")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  return NextResponse.json({
    equipment: profile?.equipment ?? {},
    body_level: profile?.body_level ?? 1,
  });
}
