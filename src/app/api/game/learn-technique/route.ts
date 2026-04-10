// POST /api/game/learn-technique — consume a technique book from inventory and learn it
import { NextRequest, NextResponse } from "next/server";
import { getTechniqueByBook } from "@/lib/techniques";
import { hasTag } from "@/lib/items";
import { z } from "zod";

const schema = z.object({
  item_type: z.string(),
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

  const technique = getTechniqueByBook(body.item_type);
  if (!technique) {
    return NextResponse.json({ error: "Item is not a learnable technique book" }, { status: 400 });
  }

  // Check inventory
  const { data: inv } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("item_type", body.item_type)
    .single();
  if (!inv || inv.quantity <= 0) {
    return NextResponse.json({ error: "Item not owned" }, { status: 400 });
  }

  // Check if already learned
  const { data: existing } = await supabase
    .from("player_techniques")
    .select("id, mastery_level")
    .eq("user_id", user.id).eq("slot", slot)
    .eq("technique_slug", technique.slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Already learned" }, { status: 400 });
  }

  // Consume book
  if (inv.quantity > 1) {
    await supabase
      .from("inventory_items")
      .update({ quantity: inv.quantity - 1 })
      .eq("id", inv.id);
  } else {
    await supabase
      .from("inventory_items")
      .delete()
      .eq("id", inv.id);
  }

  // Insert technique row at Lv.1
  await supabase
    .from("player_techniques")
    .insert({
      user_id: user.id,
      slot,
      technique_slug: technique.slug,
      mastery_level: 1,
      mastery_xp: 0,
    });

  return NextResponse.json({
    learned: technique.slug,
    mastery_level: 1,
  });
}
