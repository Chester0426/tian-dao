// POST /api/game/meditate/session — start or stop a meditation idle session
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  let action: "start" | "stop" = "start";
  try {
    const body = await request.json();
    if (body?.action === "stop") action = "stop";
  } catch {}

  // Find existing meditate session for this user+slot
  const { data: existing } = await supabase
    .from("idle_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .eq("type", "meditate")
    .order("started_at", { ascending: false })
    .limit(1);

  const row = existing?.[0];

  if (action === "start") {
    // End any active mining session (mutual exclusion)
    await supabase
      .from("idle_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("slot", slot)
      .eq("type", "mining")
      .is("ended_at", null);

    const nowIso = new Date().toISOString();
    if (row) {
      await supabase
        .from("idle_sessions")
        .update({ started_at: nowIso, last_sync_at: nowIso, ended_at: null })
        .eq("id", row.id);
    } else {
      await supabase
        .from("idle_sessions")
        .insert({ user_id: user.id, slot, type: "meditate", started_at: nowIso, last_sync_at: nowIso });
    }
    return NextResponse.json({ ok: true });
  }

  // stop
  if (row) {
    await supabase
      .from("idle_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  return NextResponse.json({ ok: true });
}
