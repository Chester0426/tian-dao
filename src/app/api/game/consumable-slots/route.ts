// POST /api/game/consumable-slots — save consumable slot configuration
import { NextRequest, NextResponse } from "next/server";
import { hasTag } from "@/lib/items";
import { z } from "zod";

const schema = z.object({
  consumable_slots: z.array(z.string().nullable()).length(3),
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

  // Validate: each non-null item must be a consumable tag and owned
  for (const itemType of body.consumable_slots) {
    if (!itemType) continue;
    if (!hasTag(itemType, "consumable")) {
      return NextResponse.json({ error: `${itemType} is not a consumable` }, { status: 400 });
    }
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", itemType)
      .maybeSingle();
    if (!inv || inv.quantity <= 0) {
      return NextResponse.json({ error: `${itemType} not owned` }, { status: 400 });
    }
  }

  await supabase
    .from("profiles")
    .update({ consumable_slots: body.consumable_slots })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ ok: true });
}
