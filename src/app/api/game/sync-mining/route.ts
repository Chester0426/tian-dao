// POST /api/game/sync-mining — Batch sync mining results (called every ~30s)
// Client does local mining calculation, server validates and persists
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSlotFromRequest } from "@/lib/slot-api";
import { melvorXpForLevel } from "@/lib/types";
import { z } from "zod";

const MAX_ACTIONS_PER_SECOND = 0.4; // 1 action per 3s = 0.333/s, allow 20% tolerance

const schema = z.object({
  mine_id: z.string(),
  actions: z.number().int().min(0).max(600), // max ~30min worth
  elapsed_ms: z.number().int().min(0),
  drops: z.record(z.string(), z.number().int().min(0)), // { coal: 5, copper_ore: 3 }
  xp: z.object({
    mining: z.number().int().min(0),
    mastery: z.number().int().min(0),
    body: z.number().int().min(0),
  }),
});

export async function POST(req: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const result = await verifyProfile(req);
  if ("error" in result) return result.error;
  const { user, slot, supabase } = result;

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { mine_id, actions, elapsed_ms, drops, xp } = body;

  // === Anomaly Detection ===
  const anomalies: string[] = [];

  // Check 1: actions vs time — can't mine faster than 1 per 3 seconds
  const maxActions = Math.ceil((elapsed_ms / 1000) * MAX_ACTIONS_PER_SECOND);
  if (actions > maxActions) {
    anomalies.push(`actions_too_fast: ${actions} actions in ${elapsed_ms}ms (max ${maxActions})`);
  }

  // Check 2: total drops should equal actions (1 drop per action, or 2 if double)
  const totalDrops = Object.values(drops).reduce((sum, q) => sum + q, 0);
  if (totalDrops > actions * 2) { // max 2x if every action is double drop
    anomalies.push(`drops_too_many: ${totalDrops} drops for ${actions} actions`);
  }

  // Check 3: XP should match actions * max XP per action
  const maxXpPerAction = 15; // spirit_stone_fragment gives 15
  if (xp.mining > actions * maxXpPerAction) {
    anomalies.push(`xp_mining_too_high: ${xp.mining} for ${actions} actions`);
  }

  // Check 4: spirit stone ratio (15% expected, flag if > 40%)
  const spiritStones = drops["spirit_stone_fragment"] ?? 0;
  if (actions > 20 && totalDrops > 0 && spiritStones / totalDrops > 0.4) {
    anomalies.push(`spirit_stone_ratio_suspicious: ${spiritStones}/${totalDrops} = ${((spiritStones/totalDrops)*100).toFixed(1)}%`);
  }

  // If severe anomaly (3+ flags), reject entirely
  if (anomalies.length >= 3) {
    console.error(`[ANOMALY] user=${user.id} slot=${slot} flags=${anomalies.length}:`, anomalies);
    return NextResponse.json({ error: "Sync rejected", anomalies }, { status: 400 });
  }

  // If minor anomaly (1-2 flags), cap values to reasonable maximums and log
  if (anomalies.length > 0) {
    console.warn(`[ANOMALY] user=${user.id} slot=${slot} flags=${anomalies.length}:`, anomalies);
  }

  // Cap actions to maximum reasonable value
  const safeActions = Math.min(actions, maxActions);
  const actionRatio = safeActions > 0 && actions > 0 ? safeActions / actions : 1;

  // Scale drops and XP proportionally if capped
  const safeDrops: Record<string, number> = {};
  for (const [item, qty] of Object.entries(drops)) {
    safeDrops[item] = Math.floor(qty * actionRatio);
  }
  const safeXp = {
    mining: Math.floor(xp.mining * actionRatio),
    mastery: Math.floor(xp.mastery * actionRatio),
    body: Math.floor(xp.body * actionRatio),
  };

  // === Apply to DB ===

  // Update inventory
  for (const [itemType, quantity] of Object.entries(safeDrops)) {
    if (quantity <= 0) continue;
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", itemType)
      .single();

    if (existing) {
      await supabase.rpc("increment_item_quantity", {
        p_item_type: itemType,
        p_quantity: quantity,
        p_slot: slot,
      });
    } else {
      await supabase
        .from("inventory_items")
        .insert({ user_id: user.id, slot, item_type: itemType, quantity });
    }
  }

  // Update mining skill
  const { data: skill } = await supabase
    .from("mining_skills")
    .select("level, xp")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  if (skill) {
    const newXp = skill.xp + safeXp.mining;
    let newLevel = skill.level;
    while (newLevel < 99 && newXp >= melvorXpForLevel(newLevel + 1)) {
      newLevel++;
    }
    await supabase
      .from("mining_skills")
      .update({ xp: newXp, level: newLevel })
      .eq("user_id", user.id).eq("slot", slot);
  }

  // Update mastery
  const { data: mastery } = await supabase
    .from("mine_masteries")
    .select("level, xp")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("mine_id", mine_id)
    .single();

  if (mastery) {
    const newXp = mastery.xp + safeXp.mastery;
    let newLevel = mastery.level;
    while (newLevel < 99 && newXp >= melvorXpForLevel(newLevel + 1)) {
      newLevel++;
    }
    await supabase
      .from("mine_masteries")
      .update({ xp: newXp, level: newLevel })
      .eq("user_id", user.id).eq("slot", slot)
      .eq("mine_id", mine_id);
  } else {
    await supabase
      .from("mine_masteries")
      .insert({ user_id: user.id, slot, mine_id, level: 1, xp: safeXp.mastery });
  }

  // Update body XP
  const { data: profile } = await supabase
    .from("profiles")
    .select("body_xp")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  if (profile && safeXp.body > 0) {
    const newBodyXp = profile.body_xp + safeXp.body;
    await supabase
      .from("profiles")
      .update({ body_xp: newBodyXp })
      .eq("user_id", user.id).eq("slot", slot);
  }

  // End any active meditate session for this slot (mutual exclusion)
  await supabase
    .from("idle_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "meditate")
    .is("ended_at", null);

  // Update idle session heartbeat. There is a unique constraint on (user_id, slot, type),
  // so we upsert. If the row exists but was ended, this revives it with a fresh started_at.
  const nowIso = new Date().toISOString();
  const { data: existingSession } = await supabase
    .from("idle_sessions")
    .select("id, ended_at")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "mining")
    .maybeSingle();
  if (existingSession) {
    // If previously ended, this is a new session — reset started_at. Otherwise preserve it.
    const updates: Record<string, unknown> = { last_sync_at: nowIso, mine_id, ended_at: null };
    if (existingSession.ended_at) updates.started_at = nowIso;
    await supabase
      .from("idle_sessions")
      .update(updates)
      .eq("id", existingSession.id);
  } else {
    await supabase
      .from("idle_sessions")
      .insert({ user_id: user.id, slot, type: "mining", mine_id, started_at: nowIso, last_sync_at: nowIso });
  }

  // Log sync for anomaly tracking (admin-only table, no RLS read access)
  await supabase.from("mining_sync_logs").insert({
    user_id: user.id,
    slot,
    mine_id,
    actions: safeActions,
    elapsed_ms,
    drops: safeDrops,
    xp_mining: safeXp.mining,
    xp_mastery: safeXp.mastery,
    xp_body: safeXp.body,
    anomalies,
  });

  return NextResponse.json({
    synced: true,
    actions: safeActions,
    anomalies: anomalies.length > 0 ? anomalies : undefined,
  });
}
