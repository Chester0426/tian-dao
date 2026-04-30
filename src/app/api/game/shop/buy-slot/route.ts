// POST /api/game/shop/buy-slot — Purchase inventory slot with spirit stones (b-10)
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSlotFromRequest } from "@/lib/slot-api";

// Escalating price: base 5, doubles each purchased slot
function slotPrice(currentSlots: number): number {
  const extraSlots = currentSlots - 20; // 20 is initial
  if (extraSlots <= 0) return 5;
  return 5 * Math.pow(2, extraSlots);
}

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const result = await verifyProfile(request);
  if ("error" in result) return result.error;
  const { user, slot, supabase } = result;

  // Fetch profile to compute price
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("inventory_slots")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const price = slotPrice(profile.inventory_slots);

  // Atomic buy: check balance, deduct, and increment slots in one transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc("buy_inventory_slot", {
    p_price: price,
    p_slot: slot,
  });

  if (rpcError) {
    console.error("buy_inventory_slot RPC error:", rpcError.message);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }

  if (rpcResult?.error === "insufficient_balance") {
    return NextResponse.json({
      error: "Insufficient spirit stones",
      required: price,
      available: rpcResult.available,
    }, { status: 400 });
  }

  const nextPrice = slotPrice(rpcResult.new_slots);

  return NextResponse.json({
    new_slots: rpcResult.new_slots,
    spent: rpcResult.spent,
    next_price: nextPrice,
    spirit_stone_remaining: rpcResult.spirit_stone_remaining,
  });
}
