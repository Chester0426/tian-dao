// POST /api/auth/wallet-signup — Sign up with Solana (Phantom) wallet
//
// Flow:
// 1. Verify Solana signature
// 2. Check that wallet is NOT already bound (else suggest login)
// 3. Create new Supabase user with synthetic email <address>@phantom.tiantao.app
// 4. Bind wallet to new user
// 5. Return magic link token for the client to exchange for a session

import { NextResponse } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createAdminClient } from "@/lib/supabase-admin";

const schema = z.object({
  address: z.string().min(32).max(44),
  signature: z.string(),
  message: z.string(),
});

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: Request) {
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { address, signature, message } = body;

  // Replay protection: extract timestamp from message and reject if stale.
  // Expected message format: "...時間: <ms>" or "...timestamp: <ms>"
  const tsMatch = message.match(/(?:時間|timestamp):\s*(\d+)/);
  if (tsMatch) {
    const ts = Number(tsMatch[1]);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return NextResponse.json({ error: "簽章已過期，請重新嘗試" }, { status: 401 });
    }
  }

  // Verify Solana signature
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(address);
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reject if wallet already bound — user should use /api/auth/wallet-login instead
  const { data: existing } = await admin
    .from("wallet_bindings")
    .select("user_id")
    .eq("wallet_address", address)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "此錢包已綁定帳號，請改用登入" },
      { status: 409 }
    );
  }

  // Create new user with synthetic email
  const syntheticEmail = `${address.toLowerCase()}@phantom.tiantao.app`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: { wallet_address: address, signup_method: "phantom" },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: "Failed to create account", detail: createError?.message },
      { status: 500 }
    );
  }

  const userId = created.user.id;

  // Bind wallet to new user
  const { error: bindError } = await admin
    .from("wallet_bindings")
    .insert({ user_id: userId, wallet_address: address });

  if (bindError) {
    // Roll back: delete user
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to bind wallet" }, { status: 500 });
  }

  // Generate magic link token for first sign-in
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  const actionLink = linkData.properties?.action_link ?? "";
  const hashedToken = linkData.properties?.hashed_token ?? "";

  let tokenHash = "";
  let tokenType = "magiclink";

  if (actionLink) {
    try {
      const actionUrl = new URL(actionLink);
      tokenHash = actionUrl.searchParams.get("token_hash") ?? actionUrl.searchParams.get("token") ?? "";
      tokenType = actionUrl.searchParams.get("type") ?? "magiclink";
    } catch {
      // ignore
    }
  }

  if (!tokenHash && hashedToken) {
    tokenHash = hashedToken;
  }

  if (!tokenHash) {
    return NextResponse.json({ error: "Token generation failed" }, { status: 500 });
  }

  return NextResponse.json({ verified: true, tokenHash, type: tokenType, isNewUser: true });
}
