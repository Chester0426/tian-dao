import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("waitlist").select("id").limit(1);
    checks.database = error ? error.message : "ok";
  } catch (e) {
    checks.database = e instanceof Error ? e.message : "unknown error";
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.getUser();
    // Expecting an auth error (no session) — that's fine, it means auth service is reachable
    checks.auth = error && error.message.includes("network") ? error.message : "ok";
  } catch (e) {
    checks.auth = e instanceof Error ? e.message : "unknown error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
