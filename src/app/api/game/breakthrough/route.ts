// POST /api/game/breakthrough — Advance 練體 stage (b-06, b-07)
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { melvorXpForLevel } from "@/lib/types";
import { trackServerEvent } from "@/lib/analytics-server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch player profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const currentStage = profile.cultivation_stage;

  // Must be in 練體 stages 1-9 to break through
  if (currentStage > 9) {
    return NextResponse.json({ error: "Already past 練體 stages. Use skill track." }, { status: 400 });
  }

  // Check if XP is sufficient for breakthrough
  const xpRequired = melvorXpForLevel(currentStage + 1) - melvorXpForLevel(currentStage);
  if (profile.body_xp < xpRequired) {
    return NextResponse.json({
      error: "Insufficient XP for breakthrough",
      xp_current: profile.body_xp,
      xp_required: xpRequired,
    }, { status: 400 });
  }

  // 100% success rate for 練體 1-9
  const newStage = currentStage + 1;
  const leftoverXp = profile.body_xp - xpRequired;

  // If reaching stage 10 (past 練體9), unlock skill track (b-07)
  const isPostBodyTempering = newStage > 9;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      cultivation_stage: newStage,
      body_xp: leftoverXp,
      // If unlocking skill track, initialize at level 9
      ...(isPostBodyTempering ? { body_skill_level: 9, body_skill_xp: 0 } : {}),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("breakthrough update error:", updateError.message);
    return NextResponse.json({ error: "Failed to perform breakthrough" }, { status: 500 });
  }

  await trackServerEvent("breakthrough_complete", user.id, {
    from_stage: currentStage,
    to_stage: newStage,
    unlocked_skill_track: isPostBodyTempering,
  });

  return NextResponse.json({
    new_stage: newStage,
    leftover_xp: leftoverXp,
    unlocked_skill_track: isPostBodyTempering,
  });
}
