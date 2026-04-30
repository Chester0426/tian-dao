// GET /api/auth/wallet-nonce
//
// Issues a one-time-use nonce for wallet sign-in. The client must include this
// nonce verbatim in the message it asks the wallet to sign. /wallet-login and
// /wallet-signup verify and consume the nonce when the signed payload arrives.
//
// This is the primary defense against:
//   - Replay attacks (each nonce works once)
//   - Cross-site phishing (attacker can't pre-compute a valid nonce-bearing
//     message because nonces are server-issued and consumed atomically)

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("issue_wallet_nonce");
  if (error || !data) {
    return NextResponse.json({ error: "Failed to issue nonce" }, { status: 500 });
  }
  return NextResponse.json({ nonce: data });
}
