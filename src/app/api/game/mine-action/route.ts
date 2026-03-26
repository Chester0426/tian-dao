// POST /api/game/mine-action — Execute a mining action (b-03, b-04, b-05)
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMasteryDoubleDropChance, melvorXpForLevel } from "@/lib/types";

const MineActionSchema = z.object({
  mine_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MineActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { mine_id } = parsed.data;

  // Server-side cooldown: check last mine action timestamp (3s minimum interval)
  const { data: lastSession } = await supabase
    .from("idle_sessions")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("type", "mining")
    .single();

  if (lastSession?.started_at) {
    const elapsed = Date.now() - new Date(lastSession.started_at).getTime();
    if (elapsed < 3000) {
      return NextResponse.json(
        { error: "Mining cooldown active", retry_after_ms: 3000 - elapsed },
        { status: 429 }
      );
    }
  }

  // Fetch mine definition
  const { data: mine, error: mineError } = await supabase
    .from("mines")
    .select("*")
    .eq("id", mine_id)
    .single();

  if (mineError || !mine) {
    return NextResponse.json({ error: "Mine not found" }, { status: 404 });
  }

  // Fetch player profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found. Call init-profile first." }, { status: 404 });
  }

  // Fetch mining skill
  const { data: miningSkill } = await supabase
    .from("mining_skills")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!miningSkill) {
    return NextResponse.json({ error: "Mining skill not found" }, { status: 404 });
  }

  // Check mining level requirement
  if (miningSkill.level < mine.required_level) {
    return NextResponse.json({ error: "Mining level too low" }, { status: 403 });
  }

  // Fetch or create mastery for this mine
  let { data: mastery } = await supabase
    .from("mine_masteries")
    .select("*")
    .eq("user_id", user.id)
    .eq("mine_id", mine_id)
    .single();

  if (!mastery) {
    const { data: newMastery, error: masteryCreateError } = await supabase
      .from("mine_masteries")
      .insert({ user_id: user.id, mine_id, level: 1, xp: 0 })
      .select()
      .single();
    if (masteryCreateError) {
      console.error("mastery create error:", masteryCreateError.message);
      return NextResponse.json({ error: "Failed to init mastery" }, { status: 500 });
    }
    mastery = newMastery;
  }

  // Parse loot table from JSONB
  const lootTable = mine.loot_table as { item_type: string; probability: number }[];

  // Roll loot
  const roll = Math.random();
  let cumulative = 0;
  let droppedItem = lootTable[lootTable.length - 1].item_type;
  for (const entry of lootTable) {
    cumulative += entry.probability;
    if (roll <= cumulative) {
      droppedItem = entry.item_type;
      break;
    }
  }

  // Check double drop (b-05)
  const doubleDropChance = getMasteryDoubleDropChance(mastery.level);
  const isDoubleDrop = Math.random() < doubleDropChance;
  const dropQuantity = isDoubleDrop ? 2 : 1;

  // Check inventory capacity
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("id, item_type")
    .eq("user_id", user.id);

  const existingSlot = inventory?.find((item: { id: string; item_type: string }) => item.item_type === droppedItem);
  const slotsUsed = new Set(inventory?.map((item: { id: string; item_type: string }) => item.item_type) ?? []).size;

  if (!existingSlot && slotsUsed >= profile.inventory_slots) {
    // Inventory full, new item type (b-09)
    return NextResponse.json({
      error: "Inventory full",
      inventory_full: true,
      would_drop: droppedItem,
    }, { status: 409 });
  }

  // Add item to inventory (upsert: increment quantity if exists)
  if (existingSlot) {
    const { error: updateError } = await supabase.rpc("increment_item_quantity", {
      p_item_type: droppedItem,
      p_quantity: dropQuantity,
    });
    if (updateError) {
      console.error("inventory update error:", updateError.message);
      return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase
      .from("inventory_items")
      .insert({ user_id: user.id, item_type: droppedItem, quantity: dropQuantity });
    if (insertError) {
      console.error("inventory insert error:", insertError.message);
      return NextResponse.json({ error: "Failed to add to inventory" }, { status: 500 });
    }
  }

  // Award XP (mining skill, mastery, 練體)
  const xpMining = mine.xp_mining as number;
  const xpMastery = mine.xp_mastery as number;
  const xpBody = mine.xp_body as number;

  // Update mining skill XP and level
  const newMiningXp = miningSkill.xp + xpMining;
  let newMiningLevel = miningSkill.level;
  while (newMiningLevel < 99 && newMiningXp >= melvorXpForLevel(newMiningLevel + 1)) {
    newMiningLevel++;
  }

  await supabase
    .from("mining_skills")
    .update({ xp: newMiningXp, level: newMiningLevel })
    .eq("user_id", user.id);

  // Update mastery XP and level
  const newMasteryXp = mastery.xp + xpMastery;
  let newMasteryLevel = mastery.level;
  while (newMasteryLevel < 99 && newMasteryXp >= melvorXpForLevel(newMasteryLevel + 1)) {
    newMasteryLevel++;
  }

  await supabase
    .from("mine_masteries")
    .update({ xp: newMasteryXp, level: newMasteryLevel })
    .eq("user_id", user.id)
    .eq("mine_id", mine_id);

  // Update 練體 XP (body tempering)
  let newBodyXp = profile.body_xp + xpBody;
  const newCultivationStage = profile.cultivation_stage;
  let newBodySkillXp = profile.body_skill_xp;
  let newBodySkillLevel = profile.body_skill_level;

  // If still in 練體 stages 1-9, apply body XP to stage
  // (Breakthrough is manual, so just accumulate XP here)
  // If post-練體9, apply to skill track
  if (profile.cultivation_stage > 9) {
    newBodySkillXp = profile.body_skill_xp + xpBody;
    while (newBodySkillLevel < 99 && newBodySkillXp >= melvorXpForLevel(newBodySkillLevel + 1)) {
      newBodySkillLevel++;
    }
    newBodyXp = profile.body_xp; // keep stage XP unchanged
  }

  await supabase
    .from("profiles")
    .update({
      body_xp: newBodyXp,
      cultivation_stage: newCultivationStage,
      body_skill_xp: newBodySkillXp,
      body_skill_level: newBodySkillLevel,
    })
    .eq("user_id", user.id);

  // Update idle session (mark as active mining)
  await supabase
    .from("idle_sessions")
    .upsert({
      user_id: user.id,
      type: "mining",
      mine_id,
      started_at: new Date().toISOString(),
      ended_at: null,
    }, { onConflict: "user_id,type" });

  return NextResponse.json({
    drop: { item_type: droppedItem, quantity: dropQuantity, is_double: isDoubleDrop },
    xp: { mining: xpMining, mastery: xpMastery, body: xpBody },
    levels: {
      mining: newMiningLevel,
      mastery: newMasteryLevel,
      cultivation_stage: newCultivationStage,
      body_skill_level: newBodySkillLevel,
    },
  });
}
