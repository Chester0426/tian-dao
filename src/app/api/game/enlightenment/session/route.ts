// POST /api/game/enlightenment/session — start or stop an enlightenment session
// payload target is either { kind: "book", item_type } or { kind: "technique", technique_slug }
import { NextRequest, NextResponse } from "next/server";
import { hasTag } from "@/lib/items";
import { getTechnique, MAX_MASTERY_LEVEL } from "@/lib/techniques";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["start", "stop"]),
  target: z
    .union([
      z.object({ kind: z.literal("book"), item_type: z.string() }),
      z.object({ kind: z.literal("technique"), technique_slug: z.string() }),
    ])
    .optional(),
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

  const nowIso = new Date().toISOString();

  if (body.action === "stop") {
    await supabase
      .from("idle_sessions")
      .update({ ended_at: nowIso })
      .eq("user_id", user.id).eq("slot", slot)
      .eq("type", "enlightenment")
      .is("ended_at", null);
    return NextResponse.json({ ok: true });
  }

  // start — validate target
  if (!body.target) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  if (body.target.kind === "book") {
    if (!hasTag(body.target.item_type, "book")) {
      return NextResponse.json({ error: "Not a book" }, { status: 400 });
    }
    // Must own at least 1
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", body.target.item_type)
      .maybeSingle();
    if (!inv || inv.quantity <= 0) {
      return NextResponse.json({ error: "Book not owned" }, { status: 400 });
    }
  } else {
    // technique — must be learned and not capped
    const tech = getTechnique(body.target.technique_slug);
    if (!tech) return NextResponse.json({ error: "Unknown technique" }, { status: 400 });
    const { data: learned } = await supabase
      .from("player_techniques")
      .select("mastery_level")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("technique_slug", body.target.technique_slug)
      .maybeSingle();
    if (!learned) return NextResponse.json({ error: "Technique not learned" }, { status: 400 });
    if (learned.mastery_level >= MAX_MASTERY_LEVEL) {
      return NextResponse.json({ error: "Technique maxed" }, { status: 400 });
    }
  }

  // Mutual exclusion: end any other active mining/meditate/enlightenment
  await supabase
    .from("idle_sessions")
    .update({ ended_at: nowIso })
    .eq("user_id", user.id).eq("slot", slot)
    .in("type", ["mining", "meditate", "enlightenment"])
    .is("ended_at", null);

  // Upsert — there may be a previously-ended row with same (user,slot,type)
  const { data: existing } = await supabase
    .from("idle_sessions")
    .select("id")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "enlightenment")
    .maybeSingle();
  if (existing) {
    await supabase
      .from("idle_sessions")
      .update({
        started_at: nowIso,
        last_sync_at: nowIso,
        ended_at: null,
        payload: body.target,
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("idle_sessions")
      .insert({
        user_id: user.id,
        slot,
        type: "enlightenment",
        started_at: nowIso,
        last_sync_at: nowIso,
        payload: body.target,
      });
  }

  return NextResponse.json({ ok: true });
}
