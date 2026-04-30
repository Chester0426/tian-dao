// Server-side offline reward calculator — can be called from SSR layouts or API routes.
// Currently covers the meditation path (most common for post-煉體 players).
// Mining path still goes through /api/game/offline-rewards for its more complex logic.

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_OFFLINE_HOURS = 12;

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
  // Combat offline rewards are calculated and applied automatically by combat_tick RPC
  // when the user resumes (it processes attack events from last_sync_at to now,
  // including auto-respawn and death). Skipped here to avoid double-counting.

  // === Mining path ===
  // Mining offline rewards are calculated and applied automatically by mine_action RPC
  // when the user resumes (it processes all ticks owed since last_tick_at, capped at 12h).
  return null;
}
