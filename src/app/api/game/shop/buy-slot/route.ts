// POST /api/game/shop/buy-slot — Purchase inventory slot with 靈石碎片 (b-10)
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Escalating price: base 5, doubles each purchased slot
function slotPrice(currentSlots: number): number {
  const extraSlots = currentSlots - 20; // 20 is initial
  if (extraSlots <= 0) return 5;
  return 5 * Math.pow(2, extraSlots);
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const price = slotPrice(profile.inventory_slots);

  // Check if player has enough 靈石碎片
  const { data: spiritStone } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("item_type", "spirit_stone_fragment")
    .single();

  if (!spiritStone || spiritStone.quantity < price) {
    return NextResponse.json({
      error: "Insufficient 靈石碎片",
      required: price,
      available: spiritStone?.quantity ?? 0,
    }, { status: 400 });
  }

  // Deduct spirit stone fragments
  const newQuantity = spiritStone.quantity - price;
  if (newQuantity <= 0) {
    await supabase
      .from("inventory_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_type", "spirit_stone_fragment");
  } else {
    await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("user_id", user.id)
      .eq("item_type", "spirit_stone_fragment");
  }

  // Increase inventory slots
  const newSlots = profile.inventory_slots + 1;
  await supabase
    .from("profiles")
    .update({ inventory_slots: newSlots })
    .eq("user_id", user.id);

  const nextPrice = slotPrice(newSlots);

  return NextResponse.json({
    new_slots: newSlots,
    spent: price,
    next_price: nextPrice,
    spirit_stone_remaining: newQuantity > 0 ? newQuantity : 0,
  });
}
