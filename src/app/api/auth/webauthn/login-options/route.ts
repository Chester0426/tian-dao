import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";

export async function POST() {
  const admin = createAdminClient();

  // Find all registered passkey credentials
  const { data: creds, error } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports") as {
      data: { credential_id: string; transports: AuthenticatorTransportFuture[] }[] | null;
      error: unknown;
    };

  if (error || !creds?.length) {
    return NextResponse.json(
      { error: "No passkey registered" },
      { status: 404 }
    );
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? [],
    })),
    userVerification: "required",
  });

  const cookieStore = await cookies();
  cookieStore.set("webauthn-challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300,
    path: "/",
  });

  return NextResponse.json(options);
}
