// POST /api/game/offline-rewards — Calculate and apply offline progress (b-08)
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { melvorXpForLevel, getMasteryDoubleDropChance } from "@/lib/types";
import { getSlotFromRequest } from "@/lib/slot-api";

const MAX_OFFLINE_HOURS = 12;
const ACTION_INTERVAL_SECONDS = 3;
const ROCK_RESPAWN_SECONDS = 5;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slot = getSlotFromRequest(request);

  // Fetch latest idle session
  const { data: sessions } = await supabase
    .from("idle_sessions")
    .select("*")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "mining")
    .order("started_at", { ascending: false })
    .limit(1);

  const session = sessions?.[0];
  if (!session) {
    return NextResponse.json({ error: "No active idle session" }, { status: 404 });
  }

  const lastActive = new Date(session.ended_at ?? session.started_at).getTime();
  const now = Date.now();
  const secondsAway = Math.floor((now - lastActive) / 1000);

  if (secondsAway < 60) {
    return NextResponse.json({ message: "Not enough time has passed", seconds_away: secondsAway }, { status: 200 });
  }

  // Cap at 24 hours
  const effectiveSeconds = Math.min(secondsAway, MAX_OFFLINE_HOURS * 3600);

  // Fetch mine info
  const { data: mine } = await supabase
    .from("mines")
    .select("*")
    .eq("id", session.mine_id)
    .single();

  if (!mine) {
    return NextResponse.json({ error: "Mine not found for session" }, { status: 404 });
  }

  // Fetch profile and mastery for calculations
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  const { data: mastery } = await supabase
    .from("mine_masteries")
    .select("*")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("mine_id", session.mine_id)
    .single();

  const { data: miningSkill } = await supabase
    .from("mining_skills")
    .select("*")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  if (!profile || !miningSkill) {
    return NextResponse.json({ error: "Player data not found" }, { status: 404 });
  }

  const masteryLevel = mastery?.level ?? 1;
  const rockMaxHp = (mine.rock_base_hp as number) + masteryLevel;

  // Calculate total actions accounting for rock respawn cycles
  // Each rock cycle: rockMaxHp actions * 3s + 5s respawn
  const cycleDuration = rockMaxHp * ACTION_INTERVAL_SECONDS + ROCK_RESPAWN_SECONDS;
  const fullCycles = Math.floor(effectiveSeconds / cycleDuration);
  const remainderSeconds = effectiveSeconds % cycleDuration;
  const remainderActions = Math.min(
    Math.floor(remainderSeconds / ACTION_INTERVAL_SECONDS),
    rockMaxHp
  );
  const totalActions = fullCycles * rockMaxHp + remainderActions;

  // Simulate drops using loot table probabilities (deterministic averages)
  const lootTable = mine.loot_table as { item_type: string; probability: number }[];
  const doubleDropChance = getMasteryDoubleDropChance(masteryLevel);
  const dropMultiplier = 1 + doubleDropChance;

  const drops: Record<string, number> = {};
  for (const entry of lootTable) {
    const quantity = Math.floor(totalActions * entry.probability * dropMultiplier);
    if (quantity > 0) {
      drops[entry.item_type] = quantity;
    }
  }

  // Calculate XP gains
  const xpMiningTotal = totalActions * (mine.xp_mining as number);
  const xpMasteryTotal = totalActions * (mine.xp_mastery as number);
  const xpBodyTotal = totalActions * (mine.xp_body as number);

  // Apply drops to inventory
  for (const [itemType, quantity] of Object.entries(drops)) {
    const { data: existingItem } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", itemType)
      .single();

    if (existingItem) {
      await supabase.rpc("increment_item_quantity", {
        p_item_type: itemType,
        p_quantity: quantity,
        p_slot: slot,
      });
    } else {
      await supabase
        .from("inventory_items")
        .insert({ user_id: user.id, slot, item_type: itemType, quantity });
    }
  }

  // Apply mining XP
  const newMiningXp = miningSkill.xp + xpMiningTotal;
  let newMiningLevel = miningSkill.level;
  while (newMiningLevel < 99 && newMiningXp >= melvorXpForLevel(newMiningLevel + 1)) {
    newMiningLevel++;
  }
  await supabase
    .from("mining_skills")
    .update({ xp: newMiningXp, level: newMiningLevel })
    .eq("user_id", user.id).eq("slot", slot);

  // Apply mastery XP
  if (mastery) {
    const newMasteryXp = mastery.xp + xpMasteryTotal;
    let newMasteryLevel = mastery.level;
    while (newMasteryLevel < 99 && newMasteryXp >= melvorXpForLevel(newMasteryLevel + 1)) {
      newMasteryLevel++;
    }
    await supabase
      .from("mine_masteries")
      .update({ xp: newMasteryXp, level: newMasteryLevel })
      .eq("user_id", user.id).eq("slot", slot)
      .eq("mine_id", session.mine_id);
  }

  // Apply body XP
  let newBodyXp = profile.body_xp + xpBodyTotal;
  let newBodySkillXp = profile.body_skill_xp;
  let newBodySkillLevel = profile.body_skill_level;

  if (profile.cultivation_stage > 9) {
    newBodySkillXp = profile.body_skill_xp + xpBodyTotal;
    while (newBodySkillLevel < 99 && newBodySkillXp >= melvorXpForLevel(newBodySkillLevel + 1)) {
      newBodySkillLevel++;
    }
    newBodyXp = profile.body_xp;
  }

  await supabase
    .from("profiles")
    .update({
      body_xp: newBodyXp,
      body_skill_xp: newBodySkillXp,
      body_skill_level: newBodySkillLevel,
    })
    .eq("user_id", user.id).eq("slot", slot);

  // Update session end time
  await supabase
    .from("idle_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", session.id);

  return NextResponse.json({
    minutes_away: Math.floor(effectiveSeconds / 60),
    total_actions: totalActions,
    drops: Object.entries(drops).map(([item_type, quantity]) => ({ item_type, quantity })),
    xp_gained: {
      mining: xpMiningTotal,
      mastery: xpMasteryTotal,
      body: xpBodyTotal,
    },
    levels: {
      mining: newMiningLevel,
      mastery: mastery ? (mastery.level + Math.floor(xpMasteryTotal / 100)) : 1,
      body_skill_level: newBodySkillLevel,
    },
  });
}
