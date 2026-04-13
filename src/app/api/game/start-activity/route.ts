// POST /api/game/start-activity — unified activity session manager
// Uses atomic switch_activity RPC with FOR UPDATE row lock.
// A later requested_at always wins, regardless of server arrival order.
import { NextRequest, NextResponse } from "next/server";
import { hasTag } from "@/lib/items";
import { getTechnique, MAX_MASTERY_LEVEL } from "@/lib/techniques";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["mining", "meditate", "enlightenment"]),
  requested_at: z.number(),
  mine_id: z.string().optional(),
  target: z.union([
    z.object({ kind: z.literal("book"), item_type: z.string() }),
    z.object({ kind: z.literal("technique"), technique_slug: z.string() }),
  ]).optional(),
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

  const { type, requested_at } = body;

  // --- Validate type-specific requirements ---
  if (type === "mining" && !body.mine_id) {
    return NextResponse.json({ error: "mine_id required" }, { status: 400 });
  }

  if (type === "enlightenment") {
    if (!body.target) return NextResponse.json({ error: "target required" }, { status: 400 });
    if (body.target.kind === "book") {
      if (!hasTag(body.target.item_type, "book")) {
        return NextResponse.json({ error: "Not a book" }, { status: 400 });
      }
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
  }

  // --- Single atomic RPC call — handles mutual exclusion + timestamp comparison ---
  const { data: result, error: rpcErr } = await supabase.rpc("switch_activity", {
    p_user_id: user.id,
    p_slot: slot,
    p_type: type,
    p_started_at: new Date(requested_at).toISOString(),
    p_mine_id: type === "mining" ? body.mine_id : null,
    p_payload: type === "enlightenment" ? body.target : null,
  });

  if (rpcErr) {
    return NextResponse.json({ error: "Failed", detail: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json(result ?? { ok: true, type });
}
