// POST /api/game/combat/sync — batch combat results (kills, loot, xp)
// Also serves as heartbeat for offline detection
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  kills: z.number().int().min(0),
  body_xp: z.number().int().min(0),
  loot_box: z.array(z.object({
    item_type: z.string(),
    quantity: z.number().int().min(1),
  })),
  player_died: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Type guard: only process if active session is combat
  const { data: activeSession } = await supabase
    .from("idle_sessions")
    .select("type")
    .eq("user_id", user.id).eq("slot", slot)
    .is("ended_at", null)
    .maybeSingle();
  if (!activeSession || activeSession.type !== "combat") {
    return NextResponse.json({ synced: false, reason: "not_combat" });
  }

  // Apply body XP
  if (body.body_xp > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_xp")
      .eq("user_id", user.id).eq("slot", slot)
      .single();
    if (profile) {
      await supabase
        .from("profiles")
        .update({ body_xp: (profile.body_xp ?? 0) + body.body_xp })
        .eq("user_id", user.id).eq("slot", slot);
    }
  }

  // Save loot box
  if (body.loot_box.length > 0) {
    await supabase
      .from("profiles")
      .update({ loot_box: body.loot_box })
      .eq("user_id", user.id).eq("slot", slot);
  }

  // Heartbeat
  await supabase.rpc("sync_heartbeat", { p_user_id: user.id, p_slot: slot, p_type: "combat" });

  // If player died, end session
  if (body.player_died) {
    await supabase.rpc("stop_activity", { p_user_id: user.id, p_slot: slot });
  }

  return NextResponse.json({ ok: true });
}
