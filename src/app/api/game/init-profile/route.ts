// POST /api/game/init-profile — Create initial profile for a new player (b-02)
// TODO: Add production rate limiting (e.g., Upstash Redis)
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { trackServerEvent } from "@/lib/analytics-server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ message: "Profile already exists" }, { status: 200 });
  }

  // Create profile with initial state: 練體1階, 20 inventory slots
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      cultivation_stage: 1,
      body_xp: 0,
      body_skill_level: 1,
      body_skill_xp: 0,
      inventory_slots: 20,
    });

  if (profileError) {
    console.error("init-profile error:", profileError.message);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Create initial mining skill record
  const { error: miningError } = await supabase
    .from("mining_skills")
    .insert({
      user_id: user.id,
      level: 1,
      xp: 0,
    });

  if (miningError) {
    console.error("init-profile mining skill error:", miningError.message);
    // Profile created but mining skill failed -- non-fatal
  }

  await trackServerEvent("signup_complete", user.id, { method: "email" });

  return NextResponse.json({ message: "Profile created" }, { status: 201 });
}
