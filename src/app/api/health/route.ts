import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  try {
    const supabase = await createServerSupabaseClient();

    // Database connectivity check
    const { error: dbError } = await supabase
      .from("waitlist")
      .select("id")
      .limit(1);
    checks.database = dbError ? dbError.message : "ok";

    // Auth service check
    const { error: authError } = await supabase.auth.getUser();
    // Expect an auth error (no session) — but not a network error
    checks.auth =
      authError && authError.message.includes("missing")
        ? "ok"
        : authError
          ? authError.message
          : "ok";
  } catch (err) {
    checks.database = err instanceof Error ? err.message : "unknown error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
