// GET /api/game/profile-data — return equipment sets, active session, and profile data
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const [{ data: profile }, { data: session }] = await Promise.all([
    supabase
      .from("profiles")
      .select("equipment_sets, active_equipment_set, body_level")
      .eq("user_id", user.id).eq("slot", slot)
      .single(),
    supabase
      .from("idle_sessions")
      .select("type, payload")
      .eq("user_id", user.id).eq("slot", slot)
      .is("ended_at", null)
      .maybeSingle(),
  ]);

  const allSets = (profile?.equipment_sets ?? { "1": {}, "2": {} }) as Record<string, Record<string, string>>;
  const activeSet = profile?.active_equipment_set ?? 1;

  return NextResponse.json({
    equipment_sets: allSets,
    active_equipment_set: activeSet,
    equipment: allSets[String(activeSet)] ?? {},
    body_level: profile?.body_level ?? 1,
    active_session: session ? { type: session.type, payload: session.payload } : null,
  });
}
