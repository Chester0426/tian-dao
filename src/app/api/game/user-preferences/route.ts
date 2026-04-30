// POST /api/game/user-preferences — update user preferences
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const body = await request.json();

  // Read current preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_preferences")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  const current = (profile?.user_preferences ?? {}) as Record<string, unknown>;
  const updated = { ...current, ...body };

  await supabase
    .from("profiles")
    .update({ user_preferences: updated })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ ok: true });
}
