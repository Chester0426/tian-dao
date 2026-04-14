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

  return NextResponse.json({ ok: true, healed: itemDef.healHp, remaining: inv.quantity - 1 });
}
