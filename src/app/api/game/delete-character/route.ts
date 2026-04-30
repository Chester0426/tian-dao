import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const schema = z.object({
  slot: z.number().int().min(1).max(3),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input: slot must be 1-3" }, { status: 400 });
  }

  const { slot } = body;

  // Delete all data for this slot in correct order (foreign key constraints)
  // idle_sessions, mine_masteries, inventory_items, mining_skills, profiles
  await supabase.from("idle_sessions").delete().eq("user_id", user.id).eq("slot", slot);
  await supabase.from("mine_masteries").delete().eq("user_id", user.id).eq("slot", slot);
  await supabase.from("inventory_items").delete().eq("user_id", user.id).eq("slot", slot);
  await supabase.from("mining_skills").delete().eq("user_id", user.id).eq("slot", slot);
  await supabase.from("profiles").delete().eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ deleted: true, slot });
}
