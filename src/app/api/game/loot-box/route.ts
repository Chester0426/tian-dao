// GET  /api/game/loot-box — read loot box
// POST /api/game/loot-box — update loot box (add drops or clear after collect)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  loot_box: z.array(z.object({
    item_type: z.string(),
    quantity: z.number().int().min(1),
  })),
});

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  const { data: profile } = await supabase
    .from("profiles")
    .select("loot_box")
    .eq("user_id", user.id).eq("slot", slot)
    .single();

  return NextResponse.json({ loot_box: profile?.loot_box ?? [] });
}

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  let body;
  try {
    body = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await supabase
    .from("profiles")
    .update({ loot_box: body.loot_box })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ ok: true });
}
