// POST /api/game/mine-action — Execute a mining action (b-03, b-04, b-05)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMasteryDoubleDropChance, melvorXpForLevel, totalMiningXpForLevel, miningXpForLevel, bodyXpForStage } from "@/lib/types";
import { getSlotFromRequest } from "@/lib/slot-api";

const MineActionSchema = z.object({
  mine_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const result = await verifyProfile(request);
  if ("error" in result) return result.error;
  const { user, slot, supabase } = result;

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

  // Cooldown: check last_sync_at — must be at least 2s since last action (3s normal, 33% tolerance)
  const { data: session } = await supabase
    .from("idle_sessions")
    .select("last_sync_at, started_at")
    .eq("user_id", user.id).eq("slot", slot)
    .is("ended_at", null)
    .maybeSingle();

  if (session) {
    const lastAction = session.last_sync_at ?? session.started_at;
    const msSinceAction = Date.now() - new Date(lastAction).getTime();
    if (msSinceAction < 2000) {
      return NextResponse.json({ error: "Too fast", cooldown_ms: 2000 - msSinceAction }, { status: 429 });
    }
    // Update last_sync_at as cooldown marker
    await supabase.from("idle_sessions")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("slot", slot)
      .is("ended_at", null);
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
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found. Call init-profile first." }, { status: 404 });
  }

  // Fetch mining skill
  const { data: miningSkill } = await supabase
    .from("mining_skills")
    .select("*")
    .eq("user_id", user.id).eq("slot", slot)
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
    .eq("user_id", user.id).eq("slot", slot)
    .eq("mine_id", mine_id)
    .single();

  if (!mastery) {
    const { data: newMastery, error: masteryCreateError } = await supabase
      .from("mine_masteries")
      .insert({ user_id: user.id, slot, mine_id, level: 1, xp: 0 })
      .select()
      .single();
    if (masteryCreateError) {
      console.error("mastery create error:", masteryCreateError.message);
      return NextResponse.json({ error: "Failed to init mastery" }, { status: 500 });
    }
    mastery = newMastery;
  }

  // Roll loot: main drop (always) + companion drops (per chance)
  const mainDrop = (mine.main_drop as string) ?? "coal";
  const companionDrops = (mine.companion_drops as { item: string; chance: number }[]) ?? [];

  const doubleDropChance = getMasteryDoubleDropChance(mastery.level);
  const isDoubleDrop = Math.random() < doubleDropChance;
  const mainQty = isDoubleDrop ? 2 : 1;

  // Collect all drops
  const allDrops: Record<string, number> = { [mainDrop]: mainQty };
  for (const cd of companionDrops) {
    if (Math.random() < cd.chance) {
      allDrops[cd.item] = (allDrops[cd.item] ?? 0) + 1;
    }
  }

  // Check inventory capacity
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("id, item_type")
    .eq("user_id", user.id).eq("slot", slot);

  const slotsUsed = new Set(inventory?.map((item: { id: string; item_type: string }) => item.item_type) ?? []).size;
  const newItemTypes = Object.keys(allDrops).filter(
    (it) => !inventory?.find((inv: { item_type: string }) => inv.item_type === it)
  );
  if (newItemTypes.length > 0 && slotsUsed + newItemTypes.length > profile.inventory_slots) {
    return NextResponse.json({
      error: "Inventory full",
      inventory_full: true,
      would_drop: mainDrop,
    }, { status: 409 });
  }

  // Add all drops to inventory
  for (const [itemType, qty] of Object.entries(allDrops)) {
    const existingSlot = inventory?.find((item: { id: string; item_type: string }) => item.item_type === itemType);
    if (existingSlot) {
      await supabase.rpc("increment_item_quantity", {
        p_item_type: itemType,
        p_quantity: qty,
        p_slot: slot,
      });
    } else {
      await supabase
        .from("inventory_items")
        .insert({ user_id: user.id, slot, item_type: itemType, quantity: qty });
    }
  }

  const droppedItem = mainDrop;
  const dropQuantity = mainQty;

  // Award XP (mining skill, mastery, 煉體)
  const xpMining = mine.xp_mining as number;
  const xpMastery = mine.xp_mastery as number;
  const xpBody = mine.xp_body as number;

  // Update mining skill XP and level
  const newMiningXp = miningSkill.xp + xpMining;
  let newMiningLevel = miningSkill.level;
  while (newMiningLevel < 500 && newMiningXp >= totalMiningXpForLevel(newMiningLevel + 1)) {
    newMiningLevel++;
  }

  await supabase
    .from("mining_skills")
    .update({ xp: newMiningXp, level: newMiningLevel })
    .eq("user_id", user.id).eq("slot", slot);

  // Update mastery XP and level
  const newMasteryXp = mastery.xp + xpMastery;
  let newMasteryLevel = mastery.level;
  while (newMasteryLevel < 99 && newMasteryXp >= melvorXpForLevel(newMasteryLevel + 1)) {
    newMasteryLevel++;
  }

  await supabase
    .from("mine_masteries")
    .update({ xp: newMasteryXp, level: newMasteryLevel })
    .eq("user_id", user.id).eq("slot", slot)
    .eq("mine_id", mine_id);

  // Update 煉體 XP (body tempering)
  let newBodyXp = profile.body_xp + xpBody;
  const newCultivationStage = profile.cultivation_stage;
  let newBodySkillXp = profile.body_skill_xp;
  let newBodySkillLevel = profile.body_skill_level;

  // Body XP can overflow past breakthrough threshold — no cap

  // If post-煉體9, apply to skill track
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
    .eq("user_id", user.id).eq("slot", slot);

  // Session already updated at the start of this request (cooldown check)

  // Fetch updated inventory for this item to return current quantity
  const { data: updatedItem } = await supabase
    .from("inventory_items")
    .select("quantity")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("item_type", droppedItem)
    .single();

  return NextResponse.json({
    drop: { item_type: droppedItem, quantity: dropQuantity, is_double: isDoubleDrop, total_quantity: updatedItem?.quantity ?? dropQuantity },
    xp: { mining: xpMining, mastery: xpMastery, body: xpBody },
    levels: {
      mining: newMiningLevel,
      mastery: newMasteryLevel,
      cultivation_stage: newCultivationStage,
      body_skill_level: newBodySkillLevel,
    },
    totals: {
      mining_xp: newMiningXp - totalMiningXpForLevel(newMiningLevel),
      mining_xp_max: miningXpForLevel(newMiningLevel),
      mastery_xp: newMasteryXp - melvorXpForLevel(newMasteryLevel),
      mastery_xp_max: melvorXpForLevel(newMasteryLevel + 1) - melvorXpForLevel(newMasteryLevel),
      body_xp: newBodyXp,
    },
  });
}
