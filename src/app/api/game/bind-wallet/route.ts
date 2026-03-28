// POST /api/game/bind-wallet — Verify wallet signature and bind to account
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";
import { verifyMessage } from "viem";

const schema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  message: z.string(),
});

const COOLDOWN_DAYS = 7;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { address, signature, message } = body;

  // Verify the signature matches the address
  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // Check if already bound
  const { data: existing } = await supabase
    .from("wallet_bindings")
    .select("wallet_address, cooldown_until")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Check cooldown
    if (existing.cooldown_until && new Date(existing.cooldown_until) > new Date()) {
      const remaining = Math.ceil((new Date(existing.cooldown_until).getTime() - Date.now()) / 86_400_000);
      return NextResponse.json({
        error: "Wallet change cooldown active",
        cooldown_remaining_days: remaining,
      }, { status: 429 });
    }

    // Update existing binding with new cooldown
    const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS * 86_400_000).toISOString();
    await supabase
      .from("wallet_bindings")
      .update({
        wallet_address: address.toLowerCase(),
        bound_at: new Date().toISOString(),
        cooldown_until: cooldownUntil,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      wallet_address: address.toLowerCase(),
      changed: true,
      cooldown_until: cooldownUntil,
    });
  }

  // First time binding — no cooldown
  await supabase
    .from("wallet_bindings")
    .insert({
      user_id: user.id,
      wallet_address: address.toLowerCase(),
    });

  return NextResponse.json({
    wallet_address: address.toLowerCase(),
    changed: false,
  });
}
