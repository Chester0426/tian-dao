// POST /api/game/sacrifice — Sacrifice items for 天道值
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSlotFromRequest } from "@/lib/slot-api";
import { z } from "zod";

const schema = z.object({
  item_type: z.string().min(1),
  quantity: z.number().int().min(1),
});

// Conversion rate: items → 天道值 (all 1:1 for now)
const DAO_POINTS_PER_ITEM: Record<string, number> = {
  coal: 1,
  copper_ore: 1,
  spirit_stone_fragment: 1,
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slot = getSlotFromRequest(req);

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { item_type, quantity } = body;
  const pointsPerItem = DAO_POINTS_PER_ITEM[item_type] ?? 1;

  // Check player has enough items
  const { data: item } = await supabase
    .from("inventory_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .eq("item_type", item_type)
    .single();

  if (!item || item.quantity < quantity) {
    return NextResponse.json({
      error: "Insufficient items",
      available: item?.quantity ?? 0,
    }, { status: 400 });
  }

  const daoPointsGained = quantity * pointsPerItem;
  const remainingQuantity = item.quantity - quantity;

  // Deduct items
  if (remainingQuantity <= 0) {
    await supabase
      .from("inventory_items")
      .delete()
      .eq("user_id", user.id)
      .eq("slot", slot)
      .eq("item_type", item_type);
  } else {
    await supabase
      .from("inventory_items")
      .update({ quantity: remainingQuantity })
      .eq("user_id", user.id)
      .eq("slot", slot)
      .eq("item_type", item_type);
  }

  // Add 天道值
  const { data: profile } = await supabase
    .from("profiles")
    .select("dao_points")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  const newDaoPoints = (profile?.dao_points ?? 0) + daoPointsGained;

  await supabase
    .from("profiles")
    .update({ dao_points: newDaoPoints })
    .eq("user_id", user.id)
    .eq("slot", slot);

  return NextResponse.json({
    sacrificed: { item_type, quantity },
    dao_points_gained: daoPointsGained,
    dao_points_total: newDaoPoints,
  });
}
