import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  // Database check
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("experiments").select("id").limit(1);
    checks.database = error ? error.message : "ok";
  } catch (e) {
    checks.database = e instanceof Error ? e.message : "error";
  }

  // Auth check
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.getUser();
    // Expect auth error (no session) — that's fine, we're checking the service is reachable
    checks.auth = error?.message?.includes("missing") || error?.message?.includes("invalid") ? "ok" : error ? error.message : "ok";
  } catch (e) {
    checks.auth = e instanceof Error ? e.message : "error";
  }

  // Payment config check
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  checks.payment = stripeKey?.startsWith("sk_") ? "ok" : "not configured";

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "not configured");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
