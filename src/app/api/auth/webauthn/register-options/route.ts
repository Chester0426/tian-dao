import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

const rpName = "天道";
const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch existing credentials for this user
  const { data: creds } = await supabase
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "天道開發者",
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: (creds ?? []).map((c: { credential_id: string }) => ({
      id: c.credential_id,
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Force Touch ID / built-in
      userVerification: "required",
      residentKey: "preferred",
    },
  });

  // Store challenge in cookie for verification
  const cookieStore = await cookies();
  cookieStore.set("webauthn-challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  return NextResponse.json(options);
}
