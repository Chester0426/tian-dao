import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSlotFromRequest } from "@/lib/slot-api";

/**
 * Verify that the authenticated user has a valid profile for the requested slot.
 * Returns { user, slot, profile, supabase } on success, or a NextResponse error.
 */
export async function verifyProfile(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const slot = getSlotFromRequest(req);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: "No profile found. Please create a character first." }, { status: 403 }) };
  }

  // Verify profile belongs to this user (extra safety)
  if (profile.user_id !== user.id) {
    return { error: NextResponse.json({ error: "Profile mismatch" }, { status: 403 }) };
  }

  return { user, slot, profile, supabase };
}
