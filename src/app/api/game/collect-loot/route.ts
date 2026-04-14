// POST /api/game/collect-loot — move loot box items to inventory
// Checks inventory space: each unique item type needs at least 1 slot
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  items: z.record(z.string(), z.number().int().min(1)),
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

  const lootItems = body.items; // { "damaged_book": 5, "coal": 3 }
  const lootTypes = Object.keys(lootItems);

  // Fetch current inventory
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("item_type, quantity")
    .eq("user_id", user.id).eq("slot", slot);

  const { data: profile } = await supabase
    .from("profiles")
    .select("inventory_slots")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  const maxSlots = profile?.inventory_slots ?? 20;
  const existingTypes = new Set((inventory ?? []).map((i: { item_type: string }) => i.item_type));
  const currentSlotCount = existingTypes.size;

  // Count how many NEW item types need a slot
  const newTypes = lootTypes.filter((t) => !existingTypes.has(t));
  const slotsNeeded = currentSlotCount + newTypes.length;

  if (slotsNeeded > maxSlots) {
    return NextResponse.json({
      error: "儲物袋空間不足，無法領取",
      error_en: "Not enough inventory space to collect",
      slots_available: maxSlots - currentSlotCount,
      new_types_needed: newTypes.length,
    }, { status: 400 });
  }

  // Add items to inventory
  for (const [itemType, qty] of Object.entries(lootItems)) {
    const existing = (inventory ?? []).find((i: { item_type: string; quantity: number }) => i.item_type === itemType) as { item_type: string; quantity: number } | undefined;
    if (existing) {
      await supabase
        .from("inventory_items")
        .update({ quantity: existing.quantity + qty })
        .eq("user_id", user.id).eq("slot", slot)
        .eq("item_type", itemType);
    } else {
      await supabase
        .from("inventory_items")
        .insert({ user_id: user.id, slot, item_type: itemType, quantity: qty });
    }
  }

  return NextResponse.json({ ok: true, collected: lootItems });
}
