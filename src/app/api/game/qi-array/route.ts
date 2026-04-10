// POST /api/game/qi-array — equip or unequip a spirit stone in a 聚靈陣 slot
import { NextRequest, NextResponse } from "next/server";
import { isSpiritStone } from "@/lib/types";
import { z } from "zod";

const schema = z.object({
  slot_index: z.number().int().min(0).max(4),
  item_type: z.string().nullable(), // null = unequip
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

  // Only slot 0 is unlocked for now
  if (body.slot_index !== 0) {
    return NextResponse.json({ error: "Slot locked" }, { status: 403 });
  }

  if (body.item_type !== null && !isSpiritStone(body.item_type)) {
    return NextResponse.json({ error: "Item is not a spirit stone" }, { status: 400 });
  }

  // Verify the item is owned (if equipping)
  if (body.item_type) {
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", body.item_type)
      .single();
    if (!inv || inv.quantity <= 0) {
      return NextResponse.json({ error: "Item not owned" }, { status: 400 });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("qi_array")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  const arr: (string | null)[] = (profile?.qi_array as (string | null)[] | null) ?? [null, null, null, null, null];
  arr[body.slot_index] = body.item_type;

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ qi_array: arr })
    .eq("user_id", user.id).eq("slot", slot);

  if (upErr) return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 500 });

  return NextResponse.json({ qi_array: arr });
}
