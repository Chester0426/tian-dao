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

  // Type guard + time validation
  const { data: activeSession } = await supabase
    .from("idle_sessions")
    .select("type, last_sync_at, started_at")
    .eq("user_id", user.id).eq("slot", slot)
    .is("ended_at", null)
    .maybeSingle();
  if (!activeSession || activeSession.type !== "combat") {
    return NextResponse.json({ synced: false, reason: "not_combat" });
  }

  // Anti-cheat: calculate max possible kills based on time since last sync
  const lastSync = activeSession.last_sync_at ?? activeSession.started_at;
  const secondsSinceSync = Math.max(0, (Date.now() - new Date(lastSync).getTime()) / 1000);
  // Fastest possible kill: 1 kill per 3s (player attack interval), allow 50% tolerance
  const maxKills = Math.ceil(secondsSinceSync / 2);
  const safeKills = Math.min(body.kills, maxKills);
  const killRatio = body.kills > 0 ? safeKills / body.kills : 1;
  const safeBodyXp = Math.floor(body.body_xp * killRatio);

  if (safeKills < body.kills) {
    console.warn(`[COMBAT ANOMALY] user=${user.id} kills=${body.kills} max=${maxKills} time=${secondsSinceSync.toFixed(0)}s`);
  }

  // Apply body XP (capped)
  if (safeBodyXp > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_xp")
      .eq("user_id", user.id).eq("slot", slot)
      .single();
    if (profile) {
      await supabase
        .from("profiles")
        .update({ body_xp: (profile.body_xp ?? 0) + safeBodyXp })
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
