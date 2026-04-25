// POST /api/game/smithing/add-fuel — burn fuel to add heat to the furnace
// body: { fuel_item: string, quantity: number }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FUELS, MAX_HEAT } from "@/lib/smithing";

const schema = z.object({
  fuel_item: z.string(),
  quantity: z.number().int().min(1),
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

  // Look up fuel definition
  const fuelDef = FUELS.find((f) => f.item === body.fuel_item);
  if (!fuelDef) {
    return NextResponse.json({ error: "Unknown fuel type" }, { status: 400 });
  }

  // Check inventory
  const { data: inv } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .eq("item_type", body.fuel_item)
    .maybeSingle();

  if (!inv || inv.quantity <= 0) {
    return NextResponse.json({ error: "Not enough fuel" }, { status: 400 });
  }

  // Get current heat
  const { data: profile } = await supabase
    .from("profiles")
    .select("furnace_heat")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  const currentHeat = profile?.furnace_heat ?? 0;

  if (currentHeat >= MAX_HEAT) {
    return NextResponse.json({ error: "Furnace is full" }, { status: 400 });
  }

  // Calculate how much heat to add (capped at MAX_HEAT)
  const requestedQty = Math.min(body.quantity, inv.quantity);
  const maxAddable = MAX_HEAT - currentHeat;
  const addHeat = Math.min(requestedQty * fuelDef.heat, maxAddable);
  const actualQty = Math.ceil(addHeat / fuelDef.heat);

  const newHeat = currentHeat + actualQty * fuelDef.heat;
  const clampedHeat = Math.min(newHeat, MAX_HEAT);

  // Update furnace heat
  await supabase
    .from("profiles")
    .update({ furnace_heat: clampedHeat })
    .eq("user_id", user.id)
    .eq("slot", slot);

  // Deduct fuel from inventory
  const remaining = inv.quantity - actualQty;
  if (remaining > 0) {
    await supabase
      .from("inventory_items")
      .update({ quantity: remaining })
      .eq("id", inv.id);
  } else {
    await supabase
      .from("inventory_items")
      .delete()
      .eq("id", inv.id);
  }

  return NextResponse.json({
    heat: clampedHeat,
    item_used: actualQty,
    remaining: Math.max(0, remaining),
  });
}
