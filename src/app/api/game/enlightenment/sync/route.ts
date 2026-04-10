// POST /api/game/enlightenment/sync — batched enlightenment tick sync
// body: { ticks: number }
// server re-reads session payload to determine target (book vs technique),
// and processes N ticks against it.
import { NextRequest, NextResponse } from "next/server";
import {
  ENLIGHTENMENT_TICK_XP,
  ENLIGHTENMENT_XP_PER_TICK,
  DAMAGED_BOOK_ENLIGHTENMENT_XP,
  MASTERY_THRESHOLDS,
  MAX_MASTERY_LEVEL,
  rollDamagedBook,
  getTechniqueByBook,
} from "@/lib/techniques";
import { z } from "zod";

const schema = z.object({
  ticks: z.number().int().min(1).max(200),
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

  const { data: session } = await supabase
    .from("idle_sessions")
    .select("id, payload, ended_at")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "enlightenment")
    .is("ended_at", null)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No active enlightenment session" }, { status: 400 });
  }

  const payload = session.payload as
    | { kind: "book"; item_type: string }
    | { kind: "technique"; technique_slug: string }
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Session missing payload" }, { status: 500 });
  }

  const requestedTicks = body.ticks;
  const nowIso = new Date().toISOString();

  // === Book path ===
  if (payload.kind === "book") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("enlightenment_xp")
      .eq("user_id", user.id).eq("slot", slot)
      .single();

    const { data: inv } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", payload.item_type)
      .maybeSingle();

    const available = inv?.quantity ?? 0;
    const ticksToProcess = Math.min(requestedTicks, available);
    if (ticksToProcess === 0) {
      // Out of books — end session
      await supabase.from("idle_sessions").update({ ended_at: nowIso }).eq("id", session.id);
      return NextResponse.json({ ticks_processed: 0, out_of_books: true });
    }

    // For damaged_book specifically: roll loot per tick. Other books (novel or future) also treated as damaged for now.
    const drops: Record<string, number> = {};
    if (payload.item_type === "damaged_book") {
      for (let i = 0; i < ticksToProcess; i++) {
        const r = rollDamagedBook();
        drops[r.item_type] = (drops[r.item_type] ?? 0) + r.quantity;
      }
    }

    // Apply drops to inventory
    for (const [itemType, qty] of Object.entries(drops)) {
      const { data: existing } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("user_id", user.id).eq("slot", slot)
        .eq("item_type", itemType)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("inventory_items")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("inventory_items")
          .insert({ user_id: user.id, slot, item_type: itemType, quantity: qty });
      }
    }

    // Consume books
    const remaining = available - ticksToProcess;
    if (remaining > 0) {
      await supabase.from("inventory_items").update({ quantity: remaining }).eq("id", inv!.id);
    } else {
      await supabase.from("inventory_items").delete().eq("id", inv!.id);
    }

    // Gain enlightenment xp
    const gainedEnlightXp = ticksToProcess * DAMAGED_BOOK_ENLIGHTENMENT_XP;
    const newEnlightXp = (profile?.enlightenment_xp ?? 0) + gainedEnlightXp;
    await supabase
      .from("profiles")
      .update({ enlightenment_xp: newEnlightXp })
      .eq("user_id", user.id).eq("slot", slot);

    // Heartbeat
    await supabase
      .from("idle_sessions")
      .update({ last_sync_at: nowIso })
      .eq("id", session.id);

    // If books ran out, end session
    if (remaining === 0) {
      await supabase.from("idle_sessions").update({ ended_at: nowIso }).eq("id", session.id);
    }

    return NextResponse.json({
      ticks_processed: ticksToProcess,
      drops: Object.entries(drops).map(([item_type, quantity]) => ({ item_type, quantity })),
      enlightenment_xp_gained: gainedEnlightXp,
      out_of_books: remaining === 0,
    });
  }

  // === Technique path ===
  const tech = getTechniqueByBook(payload.technique_slug) ?? { slug: payload.technique_slug };
  void tech;

  const { data: pt } = await supabase
    .from("player_techniques")
    .select("id, mastery_level, mastery_xp")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("technique_slug", payload.technique_slug)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Technique not learned" }, { status: 400 });
  if (pt.mastery_level >= MAX_MASTERY_LEVEL) {
    await supabase.from("idle_sessions").update({ ended_at: nowIso }).eq("id", session.id);
    return NextResponse.json({ ticks_processed: 0, maxed: true });
  }

  let level = pt.mastery_level;
  let xp = pt.mastery_xp;
  let ticksUsed = 0;
  for (let i = 0; i < requestedTicks; i++) {
    if (level >= MAX_MASTERY_LEVEL) break;
    xp += ENLIGHTENMENT_TICK_XP;
    ticksUsed++;
    // Level up cascade
    while (level < MAX_MASTERY_LEVEL && xp >= (MASTERY_THRESHOLDS[level] ?? Infinity)) {
      xp -= MASTERY_THRESHOLDS[level]!;
      level += 1;
    }
    if (level >= MAX_MASTERY_LEVEL) {
      xp = 0;
      break;
    }
  }

  await supabase
    .from("player_techniques")
    .update({ mastery_level: level, mastery_xp: xp })
    .eq("id", pt.id);

  // Gain player enlightenment xp
  const { data: profile } = await supabase
    .from("profiles")
    .select("enlightenment_xp")
    .eq("user_id", user.id).eq("slot", slot)
    .single();
  const gainedEnlightXp = ticksUsed * ENLIGHTENMENT_XP_PER_TICK;
  const newEnlightXp = (profile?.enlightenment_xp ?? 0) + gainedEnlightXp;
  await supabase
    .from("profiles")
    .update({ enlightenment_xp: newEnlightXp })
    .eq("user_id", user.id).eq("slot", slot);

  // Heartbeat
  await supabase
    .from("idle_sessions")
    .update({ last_sync_at: nowIso })
    .eq("id", session.id);

  // End session if maxed
  if (level >= MAX_MASTERY_LEVEL) {
    await supabase.from("idle_sessions").update({ ended_at: nowIso }).eq("id", session.id);
  }

  return NextResponse.json({
    ticks_processed: ticksUsed,
    mastery_level: level,
    mastery_xp: xp,
    enlightenment_xp_gained: gainedEnlightXp,
    maxed: level >= MAX_MASTERY_LEVEL,
  });
}
