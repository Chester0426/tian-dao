// POST /api/game/meditate/sync — batched meditation tick sync
import { NextRequest, NextResponse } from "next/server";
import { spiritStoneBonus } from "@/lib/types";
import { z } from "zod";

const TICK_XP = 10;
const MAX_TICKS_PER_SYNC = 200;

const schema = z.object({
  ticks: z.number().int().min(1).max(MAX_TICKS_PER_SYNC),
});

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("realm, qi_xp, qi_array")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  if (pErr || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.realm !== "練氣") return NextResponse.json({ error: "Only 練氣 can meditate" }, { status: 400 });

  const qiArray: (string | null)[] = (profile.qi_array as (string | null)[] | null) ?? [null, null, null, null, null];
  const requestedTicks = body.ticks;

  // Determine how many ticks each slot can actually contribute based on inventory
  // Each tick consumes 1 of each equipped stone. If inventory runs out, that slot clears mid-batch.
  // For fairness: we compute the max consumable ticks per slot, award bonus proportionally.
  const consumePlan: { itemType: string; available: number; bonus: number; slotIdx: number }[] = [];
  for (let i = 0; i < qiArray.length; i++) {
    const itemType = qiArray[i];
    if (!itemType) continue;
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id).eq("slot", slot)
      .eq("item_type", itemType)
      .single();
    consumePlan.push({
      itemType,
      available: inv?.quantity ?? 0,
      bonus: spiritStoneBonus(itemType),
      slotIdx: i,
    });
  }

  let totalBonusXp = 0;
  const newQiArray = [...qiArray];
  for (const plan of consumePlan) {
    const ticksUsed = Math.min(plan.available, requestedTicks);
    totalBonusXp += ticksUsed * plan.bonus;
    const remaining = plan.available - ticksUsed;

    // Deduct inventory
    if (ticksUsed > 0) {
      if (remaining > 0) {
        await supabase
          .from("inventory_items")
          .update({ quantity: remaining })
          .eq("user_id", user.id).eq("slot", slot)
          .eq("item_type", plan.itemType);
      } else {
        await supabase
          .from("inventory_items")
          .delete()
          .eq("user_id", user.id).eq("slot", slot)
          .eq("item_type", plan.itemType);
        // Clear the slot if item ran out
        newQiArray[plan.slotIdx] = null;
      }
    }
  }

  const baseXp = requestedTicks * TICK_XP;
  const gainedXp = baseXp + totalBonusXp;
  const newQiXp = (profile.qi_xp ?? 0) + gainedXp;

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ qi_xp: newQiXp, qi_array: newQiArray })
    .eq("user_id", user.id).eq("slot", slot);

  if (upErr) return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 500 });

  // Update session heartbeat
  await supabase
    .from("idle_sessions")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("slot", slot)
    .eq("type", "meditate")
    .is("ended_at", null);

  return NextResponse.json({
    qi_xp: newQiXp,
    gained_xp: gainedXp,
    base_xp: baseXp,
    bonus_xp: totalBonusXp,
    ticks: requestedTicks,
    qi_array: newQiArray,
  });
}
