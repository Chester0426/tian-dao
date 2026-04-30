import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const challenge = cookieStore.get("webauthn-challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  // Look up credential by ID
  const { data: cred, error: credError } = await admin
    .from("webauthn_credentials")
    .select("*")
    .eq("credential_id", body.id)
    .single();

  if (credError || !cred) {
    return NextResponse.json({ error: "Unknown credential" }, { status: 401 });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: cred.counter,
        transports: cred.transports ?? [],
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    // Update counter
    await admin
      .from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq("credential_id", cred.credential_id);

    // Clear challenge
    cookieStore.delete("webauthn-challenge");

    // Generate a magic link for the credential owner, then return the token
    // so the client can exchange it for a session
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: (await admin.auth.admin.getUserById(cred.user_id)).data.user?.email ?? "",
    });

    if (linkError || !linkData) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Extract the token hash and redirect URL from the action link
    const actionUrl = new URL(linkData.properties.action_link);
    const tokenHash = actionUrl.searchParams.get("token_hash") ?? "";
    const type = actionUrl.searchParams.get("type") ?? "magiclink";

    return NextResponse.json({
      verified: true,
      tokenHash,
      type,
    });
  } catch (err) {
    console.error("Authentication verification error:", err);
    return NextResponse.json({ error: "Verification error" }, { status: 400 });
  }
}
