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

  // Realm progression order
  const REALM_ORDER = ["煉體", "練氣", "築基", "金丹", "元嬰"] as const;
  const realmIdx = REALM_ORDER.indexOf(realm as typeof REALM_ORDER[number]);

  // Get current level and XP based on active realm
  let currentLevel: number;
  let currentXp: number;
  let xpField: string;
  let levelField: string;

  switch (realm) {
    case "練氣":
      currentLevel = profile.qi_level ?? 1;
      currentXp = profile.qi_xp ?? 0;
      xpField = "qi_xp";
      levelField = "qi_level";
      break;
    case "築基":
      currentLevel = profile.foundation_level ?? 1;
      currentXp = profile.foundation_xp ?? 0;
      xpField = "foundation_xp";
      levelField = "foundation_level";
      break;
    case "金丹":
      currentLevel = profile.core_level ?? 1;
      currentXp = profile.core_xp ?? 0;
      xpField = "core_xp";
      levelField = "core_level";
      break;
    case "元嬰":
      currentLevel = profile.nascent_level ?? 1;
      currentXp = profile.nascent_xp ?? 0;
      xpField = "nascent_xp";
      levelField = "nascent_level";
      break;
    default: // 煉體
      currentLevel = profile.body_level ?? 1;
      currentXp = profile.body_xp ?? 0;
      xpField = "body_xp";
      levelField = "body_level";
      break;
  }

  // Check if XP is sufficient
  const xpRequired = bodyXpForStage(currentLevel);
  if (currentXp < xpRequired) {
    return NextResponse.json({
      error: "Insufficient XP for breakthrough",
      xp_current: currentXp,
      xp_required: xpRequired,
    }, { status: 400 });
  }

  const leftoverXp = currentXp - xpRequired;

  // Check if this is a realm transition (巔峰 → next realm)
  const isPeakBreakthrough = currentLevel >= 9;
  const nextRealm = isPeakBreakthrough && realmIdx < REALM_ORDER.length - 1
    ? REALM_ORDER[realmIdx + 1]
    : null;

  let updateData: Record<string, unknown>;

  if (nextRealm) {
    // Realm transition: move to next realm at level 1
    const nextLevelField = nextRealm === "練氣" ? "qi_level"
      : nextRealm === "築基" ? "foundation_level"
      : nextRealm === "金丹" ? "core_level"
      : "nascent_level";
    const nextXpField = nextRealm === "練氣" ? "qi_xp"
      : nextRealm === "築基" ? "foundation_xp"
      : nextRealm === "金丹" ? "core_xp"
      : "nascent_xp";

    updateData = {
      realm: nextRealm,
      realm_level: 1,
      [xpField]: leftoverXp,
      [nextLevelField]: 1,
      [nextXpField]: 0,
    };
  } else {
    // Normal level up within same realm
    const newLevel = currentLevel + 1;
    updateData = {
      realm,
      realm_level: newLevel,
      [levelField]: newLevel,
      cultivation_stage: realm === "煉體" ? newLevel : profile.cultivation_stage,
      [xpField]: leftoverXp,
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("user_id", user.id)
    .eq("slot", slot);

  if (updateError) {
    console.error("breakthrough update error:", updateError.message, updateError.code, updateError.details);
    return NextResponse.json({
      error: "Failed to perform breakthrough",
      detail: updateError.message,
    }, { status: 500 });
  }

  const resultRealm = nextRealm ?? realm;
  const resultLevel = nextRealm ? 1 : currentLevel + 1;

  try {
    await trackServerEvent("breakthrough_complete", user.id, {
      realm: resultRealm,
      from_level: currentLevel,
      to_level: resultLevel,
      realm_transition: !!nextRealm,
    });
  } catch {
    // Analytics failure should not block breakthrough
  }

  return NextResponse.json({
    realm: resultRealm,
    new_level: resultLevel,
    leftover_xp: leftoverXp,
    realm_transition: !!nextRealm,
  });
}
