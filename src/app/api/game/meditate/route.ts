// POST /api/game/meditate — add qi_xp from meditation tick (10 xp per call)
import { NextRequest, NextResponse } from "next/server";

const TICK_XP = 10;
const MIN_INTERVAL_MS = 9000; // soft rate limit: allow ~1 tick per 10s (slight slack)

// In-memory rate tracking per user (per serverless instance — not strict)
const lastTick = new Map<string, number>();

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("realm, qi_level, qi_xp")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.realm !== "練氣") return NextResponse.json({ error: "Only 練氣 can meditate" }, { status: 400 });

  const key = `${user.id}:${slot}`;
  const now = Date.now();
  const last = lastTick.get(key) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: "Too fast", retry_in: MIN_INTERVAL_MS - (now - last) }, { status: 429 });
  }
  lastTick.set(key, now);

  const newXp = (profile.qi_xp ?? 0) + TICK_XP;
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ qi_xp: newXp })
    .eq("user_id", user.id)
    .eq("slot", slot);
  if (upErr) return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 500 });

  return NextResponse.json({ qi_xp: newXp, gained: TICK_XP });
}
