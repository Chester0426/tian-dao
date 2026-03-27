// POST /api/game/init-profile — Create initial profile for a new player (b-02)
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { trackServerEvent } from "@/lib/analytics-server";
import { z } from "zod";

const schema = z.object({
  slot: z.number().int().min(1).max(3).default(1),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    const raw = await req.json().catch(() => ({}));
    body = schema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { slot } = body;

  // Check if profile already exists for this slot
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  if (existing) {
    return NextResponse.json({ message: "Profile already exists", slot }, { status: 200 });
  }

  // Check max 3 characters
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "Maximum 3 characters per account" }, { status: 400 });
  }

  // Create profile with initial state: 練體1階, 20 inventory slots
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      slot,
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
      slot,
      level: 1,
      xp: 0,
    });

  if (miningError) {
    console.error("init-profile mining skill error:", miningError.message);
  }

  await trackServerEvent("signup_complete", user.id, { method: "email" });

  return NextResponse.json({ message: "Profile created", slot }, { status: 201 });
}
