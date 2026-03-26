import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  // Database connectivity check
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.database = error ? "error" : "ok";
    if (error) console.error("Health check database error:", error.message);
  } catch (e) {
    checks.database = "error";
    console.error("Health check database error:", (e as Error).message);
  }

  // Auth service check
  try {
    const supabase = await createServerSupabaseClient();
    // getUser() with no session should return an auth error, not a network error
    await supabase.auth.getUser();
    checks.auth = "ok";
  } catch (e) {
    checks.auth = "error";
    console.error("Health check auth error:", (e as Error).message);
  }

  // Analytics reachability check
  try {
    const POSTHOG_HOST = "https://us.i.posthog.com";
    const POSTHOG_KEY = "phc_9pSomMlHylLB9GXolTGMZ9jZJnITRwNaJacJLkKA8rY";
    const res = await fetch(`${POSTHOG_HOST}/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: POSTHOG_KEY, distinct_id: "healthcheck" }),
    });
    checks.analytics = res.ok ? "ok" : "error";
    if (!res.ok) console.error("Health check analytics error: HTTP", res.status);
  } catch (e) {
    checks.analytics = "error";
    console.error("Health check analytics error:", (e as Error).message);
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
