// POST /api/game/equip — equip or unequip an item
// body: { slot_id: "helmet", item_type: "poor_helmet" } to equip
// body: { slot_id: "helmet", item_type: null } to unequip
import { NextRequest, NextResponse } from "next/server";
import { getItem, type EquipSlotId } from "@/lib/items";
import { z } from "zod";

const VALID_SLOTS: EquipSlotId[] = ["helmet", "shoulder", "cape", "necklace", "main-hand", "off-hand", "chest", "gloves", "pants", "accessory", "ring", "boots"];

const schema = z.object({
  slot_id: z.string(),
  item_type: z.string().nullable(),
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

  if (!VALID_SLOTS.includes(body.slot_id as EquipSlotId)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("equipment")
    .eq("user_id", user.id).eq("slot", slot)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const equipment = (profile.equipment ?? {}) as Record<string, string>;
  const currentlyEquipped = equipment[body.slot_id] ?? null;

  if (body.item_type) {
    // Equip
    const itemDef = getItem(body.item_type);
    if (!itemDef || itemDef.equipSlot !== body.slot_id) {
      return NextResponse.json({ error: "Item cannot go in this slot" }, { status: 400 });
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

    // Remove from inventory
    if (inv.quantity > 1) {
      await supabase.from("inventory_items").update({ quantity: inv.quantity - 1 }).eq("id", inv.id);
    } else {
      await supabase.from("inventory_items").delete().eq("id", inv.id);
    }

    // If something was already equipped in this slot, return it to inventory
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

    // Update equipment
    equipment[body.slot_id] = body.item_type;
  } else {
    // Unequip — return to inventory
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

  await supabase
    .from("profiles")
    .update({ equipment })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ equipment });
}
