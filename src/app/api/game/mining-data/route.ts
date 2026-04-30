import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const [minesRes, profileRes] = await Promise.all([
    supabase.from("mines").select("*").order("required_level", { ascending: true }),
    supabase.from("profiles").select("inventory_slots").eq("user_id", user.id).eq("slot", slot).single(),
  ]);

  return NextResponse.json({
    mines: minesRes.data ?? [],
    inventorySlots: (profileRes.data as { inventory_slots: number } | null)?.inventory_slots ?? 20,
  });
}
