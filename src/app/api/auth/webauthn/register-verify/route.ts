import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const challenge = cookieStore.get("webauthn-challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  const body = await request.json();

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Store credential in database
    const { error: insertError } = await supabase
      .from("webauthn_credentials")
      .insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: body.response?.transports ?? [],
      });

    if (insertError) {
      console.error("Failed to store credential:", insertError);
      return NextResponse.json({ error: "Failed to store credential" }, { status: 500 });
    }

    // Clear challenge cookie
    cookieStore.delete("webauthn-challenge");

    return NextResponse.json({
      verified: true,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  } catch (err) {
    console.error("Registration verification error:", err);
    return NextResponse.json({ error: "Verification error" }, { status: 400 });
  }
}
