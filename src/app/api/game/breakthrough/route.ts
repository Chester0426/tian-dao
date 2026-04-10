// POST /api/game/breakthrough — Advance realm level
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { bodyXpForStage, qiXpForStage, qiBaseRate } from "@/lib/types";
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

  // Parse optional body peak target (post-煉體 body progression)
  let bodyPeak = false;
  try {
    const body = await request.json();
    if (body?.target === "body_peak") bodyPeak = true;
  } catch {
    // no body — default path
  }

  // Body peak progression: loop cascade breakthroughs in one call (no realm transition)
  if (bodyPeak) {
    if (realm === "煉體") {
      return NextResponse.json({ error: "body_peak only valid after 煉體" }, { status: 400 });
    }
    let lvl = profile.body_level ?? 1;
    let xp = profile.body_xp ?? 0;
    let count = 0;
    while (lvl >= 9 && count < 200) {
      const need = bodyXpForStage(lvl);
      if (xp < need) break;
      xp -= need;
      lvl += 1;
      count += 1;
    }
    if (count === 0) {
      return NextResponse.json({ error: "Insufficient XP", xp_current: xp, xp_required: bodyXpForStage(lvl) }, { status: 400 });
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ body_level: lvl, body_xp: xp })
      .eq("user_id", user.id)
      .eq("slot", slot);
    if (upErr) {
      return NextResponse.json({ error: "Failed", detail: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ body_peak: true, new_level: lvl, leftover_xp: xp, breakthroughs: count });
  }

  // --- 練氣 breakthrough with success probability & failure bonus ---
  if (realm === "練氣") {
    const curLvl = profile.qi_level ?? 1;
    const curXp = profile.qi_xp ?? 0;
    const need = qiXpForStage(curLvl);
    if (curXp < need) {
      return NextResponse.json({ error: "Insufficient XP", xp_current: curXp, xp_required: need }, { status: 400 });
    }

    const failBonusMap = (profile.qi_fail_bonus ?? {}) as Record<string, number>;
    const bonus = failBonusMap[String(curLvl)] ?? 0;
    const effectiveRate = Math.min(100, qiBaseRate(curLvl) + bonus);
    const roll = Math.random() * 100;
    const success = roll < effectiveRate;

    const leftoverXp = curXp - need;
    let updateData: Record<string, unknown> = {};

    if (success) {
      // Level up. If curLvl was 13, transition to 築基
      if (curLvl >= 13) {
        updateData = {
          realm: "築基",
          realm_level: 1,
          qi_xp: leftoverXp,
          foundation_level: 1,
          foundation_xp: 0,
        };
      } else {
        updateData = {
          qi_level: curLvl + 1,
          qi_xp: leftoverXp,
          realm_level: curLvl + 1,
        };
      }
    } else {
      // Failure: deduct XP, add +1% permanent bonus for this level
      const newBonus = { ...failBonusMap, [String(curLvl)]: bonus + 1 };
      updateData = {
        qi_xp: leftoverXp,
        qi_fail_bonus: newBonus,
      };
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .eq("slot", slot);
    if (upErr) {
      return NextResponse.json({ error: "Failed", detail: upErr.message }, { status: 500 });
    }

    try {
      await trackServerEvent("breakthrough_complete", user.id, {
        realm: success && curLvl >= 13 ? "築基" : "練氣",
        from_level: curLvl,
        to_level: success ? (curLvl >= 13 ? 1 : curLvl + 1) : curLvl,
        realm_transition: success && curLvl >= 13,
        success,
        rate: effectiveRate,
      });
    } catch {}

    return NextResponse.json({
      success,
      rate: effectiveRate,
      from_level: curLvl,
      new_level: success ? (curLvl >= 13 ? 1 : curLvl + 1) : curLvl,
      new_realm: success && curLvl >= 13 ? "築基" : "練氣",
      leftover_xp: leftoverXp,
      new_fail_bonus: success ? bonus : bonus + 1,
    });
  }

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

    // Cascade body peak breakthroughs using leftover body_xp (only when leaving 煉體)
    if (realm === "煉體") {
      let peakLvl = currentLevel + 1; // start at 10 (first peak level)
      let peakXp = leftoverXp;
      while (peakLvl >= 9 && peakXp >= bodyXpForStage(peakLvl)) {
        peakXp -= bodyXpForStage(peakLvl);
        peakLvl += 1;
      }
      updateData.body_level = peakLvl;
      updateData.body_xp = peakXp;
    }
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
