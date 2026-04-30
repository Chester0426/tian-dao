import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const [profileRes] = await Promise.all([
    supabase.from("profiles").select("inventory_slots").eq("user_id", user.id).eq("slot", slot).single(),
  ]);

  const currentSlots = (profileRes.data as { inventory_slots: number } | null)?.inventory_slots ?? 20;
  // 天道碎片 (TTAO) — not yet available, always 0
  const spiritStones = 0;

  return NextResponse.json({ spiritStones, currentSlots });
}
