// POST /api/game/equip — equip or unequip an item in the ACTIVE equipment set
// body: { slot_id: "helmet", item_type: "poor_helmet" } to equip
// body: { slot_id: "helmet", item_type: null } to unequip
// body: { switch_set: 2 } to switch active set (1 or 2)
import { NextRequest, NextResponse } from "next/server";
import { getItem, type EquipSlotId } from "@/lib/items";
import { z } from "zod";

const VALID_SLOTS: EquipSlotId[] = ["helmet", "shoulder", "cape", "necklace", "main-hand", "off-hand", "chest", "gloves", "pants", "accessory", "ring", "boots"];

const equipSchema = z.object({
  slot_id: z.string(),
  item_type: z.string().nullable(),
});

const switchSchema = z.object({
  switch_set: z.union([z.literal(1), z.literal(2)]),
});

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const raw = await request.json();

  // --- Switch set ---
  if ("switch_set" in raw) {
    const parsed = switchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    await supabase
      .from("profiles")
      .update({ active_equipment_set: parsed.data.switch_set })
      .eq("user_id", user.id).eq("slot", slot);

    return NextResponse.json({ active_set: parsed.data.switch_set });
  }

  // --- Equip/unequip ---
  const parsed = equipSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const body = parsed.data;

  if (!VALID_SLOTS.includes(body.slot_id as EquipSlotId)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("equipment_sets, active_equipment_set")
    .eq("user_id", user.id).eq("slot", slot)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const activeSet = String(profile.active_equipment_set ?? 1);
  const allSets = (profile.equipment_sets ?? { "1": {}, "2": {} }) as Record<string, Record<string, string>>;
  const equipment = allSets[activeSet] ?? {};
  const currentlyEquipped = equipment[body.slot_id] ?? null;

  if (body.item_type) {
    // Equip
    const itemDef = getItem(body.item_type);
    if (!itemDef || itemDef.equipSlot !== body.slot_id) {
      return NextResponse.json({ error: "Item cannot go in this slot" }, { status: 400 });
    }

    const { data: inv } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", body.item_type)
      .maybeSingle();
    if (!inv || inv.quantity <= 0) {
      return NextResponse.json({ error: "Item not owned" }, { status: 400 });
    }

    // Remove from inventory
    if (inv.quantity > 1) {
      await supabase.from("inventory_items").update({ quantity: inv.quantity - 1 }).eq("id", inv.id);
    } else {
      await supabase.from("inventory_items").delete().eq("id", inv.id);
    }

    // Return old item to inventory
    if (currentlyEquipped) {
      const { data: existingInv } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("user_id", user.id).eq("slot", slot)
        .eq("item_type", currentlyEquipped)
        .maybeSingle();
      if (existingInv) {
        await supabase.from("inventory_items").update({ quantity: existingInv.quantity + 1 }).eq("id", existingInv.id);
      } else {
        await supabase.from("inventory_items").insert({ user_id: user.id, slot, item_type: currentlyEquipped, quantity: 1 });
      }
    }

    equipment[body.slot_id] = body.item_type;
  } else {
    // Unequip
    if (!currentlyEquipped) {
      return NextResponse.json({ error: "Nothing equipped" }, { status: 400 });
    }
    const { data: existingInv } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", currentlyEquipped)
      .maybeSingle();
    if (existingInv) {
      await supabase.from("inventory_items").update({ quantity: existingInv.quantity + 1 }).eq("id", existingInv.id);
    } else {
      await supabase.from("inventory_items").insert({ user_id: user.id, slot, item_type: currentlyEquipped, quantity: 1 });
    }
    delete equipment[body.slot_id];
  }

  allSets[activeSet] = equipment;

  await supabase
    .from("profiles")
    .update({ equipment_sets: allSets })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ equipment, active_set: Number(activeSet) });
}
