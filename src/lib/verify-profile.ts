import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase-server";
import { getSlotFromRequest } from "@/lib/slot-api";

/**
 * Verify that the authenticated user has a valid profile for the requested slot.
 * Returns { user, slot, profile, supabase, serviceDb } on success, or a NextResponse error.
 * - supabase: anon key client (for auth, reads)
 * - serviceDb: service_role client (for writes, bypasses RLS)
 */
export async function verifyProfile(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const slot = getSlotFromRequest(req);
  // Use service-role client for all DB operations (bypasses RLS)
  // Auth is already verified above via anon client — user.id is trusted
  const db = createServiceSupabaseClient();

  const { data: profile } = await db
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

  // Return service client as `supabase` so all existing routes work without changes
  return { user, slot, profile, supabase: db };
}
