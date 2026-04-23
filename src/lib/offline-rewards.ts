// Server-side offline reward calculator — can be called from SSR layouts or API routes.
// Currently covers the meditation path (most common for post-煉體 players).
// Mining path still goes through /api/game/offline-rewards for its more complex logic.

import type { SupabaseClient } from "@supabase/supabase-js";
import { melvorXpForLevel, getMasteryDoubleDropChance } from "@/lib/types";
import { COMBAT_ZONES } from "@/lib/combat";
import { computeStats } from "@/lib/stats";
import { hasTag } from "@/lib/items";
import { simulateCombat } from "@/lib/combat-sim";

const MAX_OFFLINE_HOURS = 12;
const ACTION_INTERVAL_SECONDS = 3;
const ROCK_RESPAWN_SECONDS = 5;

export interface OfflineRewardResult {
  minutes_away: number;
  session_type: "mining" | "meditate" | "combat";
  drops: { item_type: string; quantity: number }[];
  xp_gained: { mining: number; mastery: number; body: number; qi?: number };
  combat?: { kills: number; died: boolean; monster_id?: string };
}

/**
 * Compute offline meditation rewards for the given slot. Mutates the DB
 * (updates qi_xp and ends session) — intended to be called once per SSR load.
 * Returns null when no reward should be shown (no session, too short, wrong realm, etc).
 */
export async function computeOfflineRewards(
  supabase: SupabaseClient,
  userId: string,
  slot: number
): Promise<OfflineRewardResult | null> {
  // Find the single session for this user+slot (UNIQUE constraint guarantees at most 1 row)
  const { data: session } = await supabase
    .from("idle_sessions")
    .select("id, type, started_at, ended_at, mine_id, last_sync_at, payload")
    .eq("user_id", userId).eq("slot", slot)
    .maybeSingle();

  if (!session) return null;
  if (session.ended_at) return null;

  // Offline time = now - last_sync_at (the last time client successfully wrote activity data).
  // A client that's alive and syncing keeps this updated every ~30s; a client that's
  // gone (tab closed, network dead, browser killed) leaves it stale.
  const lastSyncAt = session.last_sync_at ?? session.started_at;
  const secondsAway = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000);
  if (secondsAway < 60) return null;

  const effectiveSeconds = Math.min(secondsAway, MAX_OFFLINE_HOURS * 3600);

  // Optimistic lock — only proceed if last_sync_at hasn't been updated by another request.
  const nowIso = new Date().toISOString();
  const { data: lockResult } = await supabase
    .from("idle_sessions")
    .update({ last_sync_at: nowIso })
    .eq("id", session.id)
    .eq("last_sync_at", lastSyncAt)
    .select("id");
  if (!lockResult || lockResult.length === 0) return null; // lost the race

  // === Meditation path ===
  if (session.type === "meditate") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("realm, qi_xp")
      .eq("user_id", userId).eq("slot", slot)
      .single();

    if (!profile || profile.realm !== "練氣") return null;

    const qiGained = Math.floor(effectiveSeconds);
    const newQiXp = (profile.qi_xp ?? 0) + qiGained;

    await supabase
      .from("profiles")
      .update({ qi_xp: newQiXp })
      .eq("user_id", userId).eq("slot", slot);
    // last_sync_at already updated by optimistic lock above; session stays active.

    return {
      minutes_away: Math.floor(effectiveSeconds / 60),
      session_type: "meditate",
      drops: [],
      xp_gained: { mining: 0, mastery: 0, body: 0, qi: qiGained },
    };
  }

  // === Combat path ===
  if (session.type === "combat") {
    const payload = session.payload as { monster_id?: string } | null;
    if (!payload?.monster_id) return null;

    // Find monster
    let monster = null;
    for (const zone of COMBAT_ZONES) {
      monster = zone.monsters.find((m) => m.id === payload.monster_id) ?? null;
      if (monster) break;
    }
    if (!monster) return null;

    // Get player stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_level, body_xp, equipment_sets, active_equipment_set, loot_box")
      .eq("user_id", userId).eq("slot", slot)
      .single();
    if (!profile) return null;

    const allSets = (profile.equipment_sets ?? { "1": {}, "2": {} }) as Record<string, Record<string, string>>;
    const activeSet = profile.active_equipment_set ?? 1;
    const equipment = allSets[String(activeSet)] ?? {};
    const playerStats = computeStats({ bodyLevel: profile.body_level ?? 1, equipment });

    // Simulate combat — uses shared combat-sim.ts (single source of truth)
    const sim = simulateCombat(playerStats, monster, effectiveSeconds);
    const totalKills = sim.kills;
    const died = sim.died;

    if (totalKills === 0 && !died) return null;

    // Calculate rewards
    const totalBodyXp = totalKills * monster.bodyXp;
    const lootBox = (profile.loot_box ?? []) as { item_type: string; quantity: number }[];

    // Add drops to loot box — each kill gets its own slots (no cross-kill stacking)
    for (let i = 0; i < totalKills; i++) {
      const killSlots: { item_type: string; quantity: number }[] = [];
      for (const drop of monster.drops) {
        if (Math.random() > (drop.rate ?? 1)) continue;
        const isEquip = hasTag(drop.item_type, "equipment");
        for (let j = 0; j < drop.quantity; j++) {
          if (isEquip) {
            killSlots.push({ item_type: drop.item_type, quantity: 1 });
          } else {
            const existing = killSlots.find((s) => s.item_type === drop.item_type);
            if (existing) {
              existing.quantity += 1;
            } else {
              killSlots.push({ item_type: drop.item_type, quantity: 1 });
            }
          }
        }
      }
      for (const ks of killSlots) {
        if (lootBox.length < 100) lootBox.push(ks);
      }
    }

    // Apply to DB
    await supabase
      .from("profiles")
      .update({
        body_xp: (profile.body_xp ?? 0) + totalBodyXp,
        loot_box: lootBox,
      })
      .eq("user_id", userId).eq("slot", slot);

    // If died, end session
    if (died) {
      await supabase
        .from("idle_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", session.id);
    }

    return {
      minutes_away: Math.floor(effectiveSeconds / 60),
      session_type: "combat",
      drops: monster.drops.map((d) => ({ item_type: d.item_type, quantity: d.quantity * totalKills })),
      xp_gained: { mining: 0, mastery: 0, body: totalBodyXp },
      combat: { kills: totalKills, died, monster_id: payload.monster_id },
    };
  }

  // === Mining path ===
  const [{ data: mine }, { data: profile }, { data: mastery }, { data: miningSkill }] = await Promise.all([
    supabase.from("mines").select("*").eq("id", session.mine_id).single(),
    supabase.from("profiles").select("*").eq("user_id", userId).eq("slot", slot).single(),
    supabase.from("mine_masteries").select("*").eq("user_id", userId).eq("slot", slot).eq("mine_id", session.mine_id).single(),
    supabase.from("mining_skills").select("*").eq("user_id", userId).eq("slot", slot).single(),
  ]);

  if (!mine || !profile || !miningSkill) return null;

  const masteryLevel = mastery?.level ?? 0;
  const rockMaxHp = (mine.rock_base_hp as number) + masteryLevel;

  const mineRespawnSeconds = (mine.respawn_seconds as number) ?? ROCK_RESPAWN_SECONDS;
  const cycleDuration = rockMaxHp * ACTION_INTERVAL_SECONDS + mineRespawnSeconds;
  const fullCycles = Math.floor(effectiveSeconds / cycleDuration);
  const remainderSeconds = effectiveSeconds % cycleDuration;
  const remainderActions = Math.min(
    Math.floor(remainderSeconds / ACTION_INTERVAL_SECONDS),
    rockMaxHp
  );
  const totalActions = fullCycles * rockMaxHp + remainderActions;
  if (totalActions <= 0) return null;

  const mainDrop = (mine.main_drop as string) ?? "coal";
  const companionDrops = (mine.companion_drops as { item: string; chance: number }[]) ?? [];
  const doubleDropChance = getMasteryDoubleDropChance(masteryLevel);
  const dropMultiplier = 1 + doubleDropChance;

  const drops: Record<string, number> = {};
  // Main drop: 1 per action, scaled by double-drop chance
  drops[mainDrop] = Math.floor(totalActions * dropMultiplier);
  // Companion drops: each independently rolled per action
  for (const cd of companionDrops) {
    const quantity = Math.floor(totalActions * cd.chance);
    if (quantity > 0) drops[cd.item] = (drops[cd.item] ?? 0) + quantity;
  }

  const xpMiningTotal = totalActions * (mine.xp_mining as number);
  const xpMasteryTotal = totalActions * (mine.xp_mastery as number);
  const xpBodyTotal = totalActions * (mine.xp_body as number);

  // Apply drops (parallel)
  await Promise.all(
    Object.entries(drops).map(async ([itemType, quantity]) => {
      const { data: existing } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("user_id", userId).eq("slot", slot)
        .eq("item_type", itemType)
        .maybeSingle();
      if (existing) {
        await supabase.rpc("increment_item_quantity", {
          p_item_type: itemType,
          p_quantity: quantity,
          p_slot: slot,
        });
      } else {
        await supabase
          .from("inventory_items")
          .insert({ user_id: userId, slot, item_type: itemType, quantity });
      }
    })
  );

  // Mining XP
  const newMiningXp = miningSkill.xp + xpMiningTotal;
  let newMiningLevel = miningSkill.level;
  while (newMiningLevel < 99 && newMiningXp >= melvorXpForLevel(newMiningLevel + 1)) {
    newMiningLevel++;
  }

  // Body XP
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

  await Promise.all([
    supabase
      .from("mining_skills")
      .update({ xp: newMiningXp, level: newMiningLevel })
      .eq("user_id", userId).eq("slot", slot),
    mastery ? (async () => {
      const newMasteryXp = mastery.xp + xpMasteryTotal;
      let newMasteryLevel = mastery.level;
      while (newMasteryLevel < 99 && newMasteryXp >= melvorXpForLevel(newMasteryLevel + 1)) {
        newMasteryLevel++;
      }
      return supabase
        .from("mine_masteries")
        .update({ xp: newMasteryXp, level: newMasteryLevel })
        .eq("user_id", userId).eq("slot", slot)
        .eq("mine_id", session.mine_id);
    })() : Promise.resolve(),
    supabase
      .from("profiles")
      .update({ body_xp: newBodyXp, body_skill_xp: newBodySkillXp, body_skill_level: newBodySkillLevel })
      .eq("user_id", userId).eq("slot", slot),
    // last_sync_at already updated by optimistic lock above
  ]);

  return {
    minutes_away: Math.floor(effectiveSeconds / 60),
    session_type: "mining",
    drops: Object.entries(drops).map(([item_type, quantity]) => ({ item_type, quantity })),
    xp_gained: { mining: xpMiningTotal, mastery: xpMasteryTotal, body: xpBodyTotal },
  };
}
