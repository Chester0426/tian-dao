// POST /api/game/collect-loot — move loot box items to inventory
// Reads loot_box from DB (not from client) to prevent item fabrication
import { NextRequest, NextResponse } from "next/server";
import { hasTag } from "@/lib/items";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  // Read loot box from DB — single source of truth
  const { data: profile } = await supabase
    .from("profiles")
    .select("loot_box, inventory_slots")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  const lootBox = (profile?.loot_box ?? []) as { item_type: string; quantity: number }[];
  if (lootBox.length === 0) {
    return NextResponse.json({ error: "Loot box is empty" }, { status: 400 });
  }

  // Aggregate loot box items
  const lootItems: Record<string, number> = {};
  for (const slot_item of lootBox) {
    lootItems[slot_item.item_type] = (lootItems[slot_item.item_type] ?? 0) + slot_item.quantity;
  }

  // Fetch current inventory
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("item_type, quantity")
    .eq("user_id", user.id).eq("slot", slot);

  const maxSlots = profile?.inventory_slots ?? 20;
  const currentRowCount = (inventory ?? []).length;
  const existingTypes = new Set((inventory ?? []).map((i: { item_type: string }) => i.item_type));

  // Equipment = 1 row per piece; non-equipment = 1 row per new type
  let newRowsNeeded = 0;
  for (const [itemType, qty] of Object.entries(lootItems)) {
    if (hasTag(itemType, "equipment")) {
      newRowsNeeded += qty;
    } else if (!existingTypes.has(itemType)) {
      newRowsNeeded += 1;
    }
  }

  if (currentRowCount + newRowsNeeded > maxSlots) {
    return NextResponse.json({
      error: "儲物袋空間不足，無法領取",
      error_en: "Not enough inventory space to collect",
      slots_available: maxSlots - currentRowCount,
      new_rows_needed: newRowsNeeded,
    }, { status: 400 });
  }

  // Add items to inventory
  for (const [itemType, qty] of Object.entries(lootItems)) {
    if (hasTag(itemType, "equipment")) {
      const rows = Array.from({ length: qty }, () => ({
        user_id: user.id, slot, item_type: itemType, quantity: 1,
      }));
      await supabase.from("inventory_items").insert(rows);
    } else {
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
  }

  // Clear loot box in DB
  await supabase
    .from("profiles")
    .update({ loot_box: [] })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ ok: true, collected: lootItems });
}
