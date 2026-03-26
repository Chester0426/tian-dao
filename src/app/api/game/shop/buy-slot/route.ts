// POST /api/game/shop/buy-slot — Purchase inventory slot with spirit stones (b-10)
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

  // Fetch profile to compute price
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("inventory_slots")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const price = slotPrice(profile.inventory_slots);

  // Atomic buy: check balance, deduct, and increment slots in one transaction
  const { data: result, error: rpcError } = await supabase.rpc("buy_inventory_slot", {
    p_price: price,
  });

  if (rpcError) {
    console.error("buy_inventory_slot RPC error:", rpcError.message);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }

  if (result?.error === "insufficient_balance") {
    return NextResponse.json({
      error: "Insufficient spirit stones",
      required: price,
      available: result.available,
    }, { status: 400 });
  }

  const nextPrice = slotPrice(result.new_slots);

  return NextResponse.json({
    new_slots: result.new_slots,
    spent: result.spent,
    next_price: nextPrice,
    spirit_stone_remaining: result.spirit_stone_remaining,
  });
}
