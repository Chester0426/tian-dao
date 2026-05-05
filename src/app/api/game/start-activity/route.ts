// POST /api/game/start-activity — unified activity session manager
// Uses atomic switch_activity RPC with FOR UPDATE row lock.
// A later requested_at always wins, regardless of server arrival order.
import { NextRequest, NextResponse } from "next/server";
import { hasTag } from "@/lib/items";
import { getTechnique, MAX_MASTERY_LEVEL } from "@/lib/techniques";
import { COMBAT_ZONES } from "@/lib/combat";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["mining", "meditate", "enlightenment", "combat", "smithing"]),
  requested_at: z.number(),
  mine_id: z.string().optional(),
  target: z.union([
    z.object({ kind: z.literal("book"), item_type: z.string() }),
    z.object({ kind: z.literal("technique"), technique_slug: z.string() }),
    z.object({ monster_id: z.string() }),
    z.object({ recipe_id: z.string() }),
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
  if (type === "mining") {
    if (!body.mine_id) {
      return NextResponse.json({ error: "mine_id required" }, { status: 400 });
    }
    // Validate mining level requirement
    const [{ data: mine }, { data: skill }] = await Promise.all([
      supabase.from("mines").select("required_level").eq("id", body.mine_id).single(),
      supabase.from("mining_skills").select("level").eq("user_id", user.id).eq("slot", slot).maybeSingle(),
    ]);
    if (!mine) {
      return NextResponse.json({ error: "Mine not found" }, { status: 404 });
    }
    const playerLevel = skill?.level ?? 1;
    if (playerLevel < mine.required_level) {
      return NextResponse.json({ error: "Mining level too low", required: mine.required_level, current: playerLevel }, { status: 403 });
    }
  }

  if (type === "meditate") {
    // Meditation requires 練氣 realm
    const { data: prof } = await supabase
      .from("profiles")
      .select("realm")
      .eq("user_id", user.id).eq("slot", slot)
      .single();
    if (!prof || prof.realm !== "練氣") {
      return NextResponse.json({ error: "Meditation requires 練氣 realm" }, { status: 403 });
    }
  }

  if (type === "enlightenment") {
    if (!body.target) return NextResponse.json({ error: "target required" }, { status: 400 });
    const t = body.target as { kind?: string; item_type?: string; technique_slug?: string };
    if (t.kind === "book") {
      if (!t.item_type || !hasTag(t.item_type, "book")) {
        return NextResponse.json({ error: "Not a book" }, { status: 400 });
      }
      const { data: inv } = await supabase
        .from("inventory_items")
        .select("quantity")
        .eq("user_id", user.id).eq("slot", slot)
        .eq("item_type", t.item_type)
        .maybeSingle();
      if (!inv || inv.quantity <= 0) {
        return NextResponse.json({ error: "Book not owned" }, { status: 400 });
      }
    } else if (t.kind === "technique") {
      if (!t.technique_slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
      const tech = getTechnique(t.technique_slug);
      if (!tech) return NextResponse.json({ error: "Unknown technique" }, { status: 400 });
      const { data: learned } = await supabase
        .from("player_techniques")
        .select("mastery_level")
        .eq("user_id", user.id).eq("slot", slot)
        .eq("technique_slug", t.technique_slug)
        .maybeSingle();
      if (!learned) return NextResponse.json({ error: "Technique not learned" }, { status: 400 });
      if (learned.mastery_level >= MAX_MASTERY_LEVEL) {
        return NextResponse.json({ error: "Technique maxed" }, { status: 400 });
      }
    }
  }

  if (type === "smithing") {
    const target = body.target as { recipe_id?: string } | undefined;
    if (!target?.recipe_id) {
      return NextResponse.json({ error: "recipe_id required" }, { status: 400 });
    }
    const [{ data: recipe }, { data: skill }] = await Promise.all([
      supabase.from("smithing_recipes").select("level_req").eq("id", target.recipe_id).maybeSingle(),
      supabase.from("smithing_skills").select("level").eq("user_id", user.id).eq("slot", slot).maybeSingle(),
    ]);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    const playerLevel = skill?.level ?? 1;
    if (playerLevel < recipe.level_req) {
      return NextResponse.json({ error: "Smithing level too low", required: recipe.level_req, current: playerLevel }, { status: 403 });
    }
  }

  // Validate combat monster exists
  if (type === "combat") {
    const target = body.target as { monster_id?: string } | undefined;
    if (!target?.monster_id) {
      return NextResponse.json({ error: "monster_id required" }, { status: 400 });
    }
    const validMonster = COMBAT_ZONES.some((z) => z.monsters.some((m) => m.id === target.monster_id));
    if (!validMonster) {
      return NextResponse.json({ error: "Invalid monster" }, { status: 400 });
    }
  }

  // --- Single atomic RPC call — handles mutual exclusion + timestamp comparison ---
  const { data: result, error: rpcErr } = await supabase.rpc("switch_activity", {
    p_user_id: user.id,
    p_slot: slot,
    p_type: type,
    p_started_at: new Date(requested_at).toISOString(),
    p_mine_id: type === "mining" ? body.mine_id : null,
    p_payload: (type === "enlightenment" || type === "combat" || type === "smithing") ? body.target : null,
  });

  if (rpcErr) {
    return NextResponse.json({ error: "Failed", detail: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json(result ?? { ok: true, type });
}
