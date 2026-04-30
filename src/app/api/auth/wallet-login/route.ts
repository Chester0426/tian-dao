import { NextResponse } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createAdminClient } from "@/lib/supabase-admin";

const schema = z.object({
  address: z.string().min(32).max(44),
  signature: z.string(),
  message: z.string(),
  nonce: z.string().min(32).max(128),
});

export async function POST(req: Request) {
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { address, signature, message, nonce } = body;

  // Phishing defense: signed message MUST contain the server-issued nonce.
  // Without this check an attacker could submit a signature obtained on a
  // phishing site (where they'd ask the user to sign a message of their choice).
  if (!message.includes(nonce)) {
    return NextResponse.json({ error: "Nonce missing in signed message" }, { status: 400 });
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

  // Consume nonce — atomically validates existence + age + marks used.
  // After this call the nonce can never be reused, regardless of outcome.
  const { data: nonceOk, error: nonceErr } = await admin.rpc("consume_wallet_nonce", { p_nonce: nonce });
  if (nonceErr || !nonceOk) {
    return NextResponse.json({ error: "Nonce 已過期或無效，請重新嘗試" }, { status: 401 });
  }

  // Check if this wallet is bound to a user
  const { data: binding, error: bindError } = await admin
    .from("wallet_bindings")
    .select("user_id")
    .eq("wallet_address", address)
    .single();

  if (bindError || !binding) {
    return NextResponse.json({ error: "此錢包未綁定任何帳號" }, { status: 403 });
  }

  // Get the user's email to generate a magic link
  const { data: userData } = await admin.auth.admin.getUserById(binding.user_id);
  if (!userData?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 500 });
  }

  // Generate magic link token for this user
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Extract token - try action_link params first, fall back to hashed_token
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
      // URL parse failed
    }
  }

  // Fall back to hashed_token from properties
  if (!tokenHash && hashedToken) {
    tokenHash = hashedToken;
  }

  if (!tokenHash) {
    return NextResponse.json({ error: "Token generation failed", debug: { actionLink, hashedToken } }, { status: 500 });
  }

  return NextResponse.json({ verified: true, tokenHash, type: tokenType });
}
