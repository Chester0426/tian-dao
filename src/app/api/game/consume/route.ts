// POST /api/game/consume — use a consumable item (heal HP)
// body: { item_type: "dry_ration" }
import { NextRequest, NextResponse } from "next/server";
import { getItem } from "@/lib/items";
import { z } from "zod";

const schema = z.object({
  item_type: z.string(),
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

  const itemDef = getItem(body.item_type);
  if (!itemDef || !itemDef.healHp) {
    return NextResponse.json({ error: "Not a consumable" }, { status: 400 });
  }

  // Check inventory
  const { data: inv } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("item_type", body.item_type)
    .maybeSingle();
  if (!inv || inv.quantity <= 0) {
    return NextResponse.json({ error: "Item not owned" }, { status: 400 });
  }

  // Consume 1
  if (inv.quantity > 1) {
    await supabase.from("inventory_items").update({ quantity: inv.quantity - 1 }).eq("id", inv.id);
  } else {
    await supabase.from("inventory_items").delete().eq("id", inv.id);
  }

  // If user is in active combat, apply heal to session payload (server-authoritative HP).
  // Computing max_hp here keeps combat_tick free of consume-specific logic.
  const { data: session } = await supabase
    .from("idle_sessions")
    .select("id, type, payload")
    .eq("user_id", user.id).eq("slot", slot)
    .is("ended_at", null)
    .maybeSingle();

  let serverPlayerHp: number | null = null;
  if (session?.type === "combat" && session.payload && typeof (session.payload as { player_hp?: number }).player_hp === "number") {
    const payload = session.payload as { player_hp: number; [k: string]: unknown };
    // Compute max_hp: base 100 + (body_level - 1) * 10 + sum equipment hp
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_level, equipment_sets, active_equipment_set")
      .eq("user_id", user.id).eq("slot", slot)
      .single();
    let maxHp = 100;
    if (profile) {
      maxHp += Math.max(0, (profile.body_level ?? 1) - 1) * 10;
      const sets = (profile.equipment_sets ?? {}) as Record<string, Record<string, string>>;
      const activeSet = sets[String(profile.active_equipment_set ?? 1)] ?? {};
      const equippedIds = Object.values(activeSet).filter(Boolean);
      if (equippedIds.length > 0) {
        const { data: equipStats } = await supabase
          .from("equipment_items")
          .select("hp")
          .in("id", equippedIds);
        for (const e of equipStats ?? []) maxHp += e.hp;
      }
    }
    const newHp = Math.min(maxHp, payload.player_hp + itemDef.healHp);
    await supabase
      .from("idle_sessions")
      .update({ payload: { ...payload, player_hp: newHp } })
      .eq("id", session.id);
    serverPlayerHp = newHp;
  }

  return NextResponse.json({
    ok: true,
    healed: itemDef.healHp,
    remaining: inv.quantity - 1,
    player_hp: serverPlayerHp,
  });
}
