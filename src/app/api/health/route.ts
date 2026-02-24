import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_KEY = "phc_9pSomMlHylLB9GXolTGMZ9jZJnITRwNaJacJLkKA8rY";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  // Database check
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("waitlist_signups")
      .select("id")
      .limit(1);
    checks.database = error ? error.message : "ok";
  } catch (e) {
    checks.database = e instanceof Error ? e.message : "unknown error";
  }

  // Auth check
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.getUser();
    // Expects an auth error (no session), not a network error
    checks.auth = error && error.message.includes("network") ? error.message : "ok";
  } catch (e) {
    checks.auth = e instanceof Error ? e.message : "unknown error";
  }

  // Analytics check
  try {
    const res = await fetch(`${POSTHOG_HOST}/decide?v=3`, {
      method: "POST",
      body: JSON.stringify({ api_key: POSTHOG_KEY, distinct_id: "healthcheck" }),
      headers: { "Content-Type": "application/json" },
    });
    checks.analytics = res.ok ? "ok" : `status ${res.status}`;
  } catch (e) {
    checks.analytics = e instanceof Error ? e.message : "unknown error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
