// POST /api/game/breakthrough — Advance realm level
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { bodyXpForStage } from "@/lib/types";
import { trackServerEvent } from "@/lib/analytics-server";
import { getSlotFromRequest } from "@/lib/slot-api";

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const realm = profile.realm ?? "煉體";
  const bodyLevel = profile.body_level ?? profile.realm_level ?? profile.cultivation_stage ?? 1;

  // Check if XP is sufficient
  const xpRequired = bodyXpForStage(bodyLevel);
  if (profile.body_xp < xpRequired) {
    return NextResponse.json({
      error: "Insufficient XP for breakthrough",
      xp_current: profile.body_xp,
      xp_required: xpRequired,
    }, { status: 400 });
  }

  const leftoverXp = profile.body_xp - xpRequired;
  const newBodyLevel = bodyLevel + 1;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      realm,
      realm_level: newBodyLevel,
      body_level: newBodyLevel,
      cultivation_stage: newBodyLevel,
      body_xp: leftoverXp,
    })
    .eq("user_id", user.id)
    .eq("slot", slot);

  if (updateError) {
    console.error("breakthrough update error:", updateError.message);
    return NextResponse.json({ error: "Failed to perform breakthrough" }, { status: 500 });
  }

  await trackServerEvent("breakthrough_complete", user.id, {
    realm,
    from_level: bodyLevel,
    to_level: newBodyLevel,
  });

  return NextResponse.json({
    realm,
    new_level: newBodyLevel,
    leftover_xp: leftoverXp,
  });
}
