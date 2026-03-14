import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };
  let hasFailure = false;

  // Database connectivity check (stack.database: supabase)
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("specs").select("id").limit(1);
    if (error) {
      console.error("[health] Database check failed:", error.message);
      checks.database = "error";
      hasFailure = true;
    } else {
      checks.database = "ok";
    }
  } catch (e) {
    console.error("[health] Database unreachable:", e);
    checks.database = "error";
    hasFailure = true;
  }

  // Auth service check (stack.auth: supabase)
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.getUser();
    // Expect an auth error (no session), not a network error
    if (error && error.message.includes("network")) {
      console.error("[health] Auth check failed:", error.message);
      checks.auth = "error";
    } else {
      checks.auth = "ok";
    }
  } catch (e) {
    console.error("[health] Auth unreachable:", e);
    checks.auth = "error";
    hasFailure = true;
  }

  // Analytics reachability check (stack.analytics: posthog)
  try {
    const POSTHOG_HOST = "https://us.i.posthog.com";
    const POSTHOG_KEY = "phc_9pSomMlHylLB9GXolTGMZ9jZJnITRwNaJacJLkKA8rY";
    const res = await fetch(`${POSTHOG_HOST}/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: POSTHOG_KEY, distinct_id: "healthcheck" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[health] Analytics check failed: status", res.status);
      checks.analytics = "error";
      hasFailure = true;
    } else {
      checks.analytics = "ok";
    }
  } catch (e) {
    console.error("[health] Analytics unreachable:", e);
    checks.analytics = "error";
    hasFailure = true;
  }

  // Payment config check (stack.payment: stripe)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.startsWith("sk_")) {
    checks.payment = "ok";
  } else if (stripeKey) {
    checks.payment = "error";
    hasFailure = true;
  } else {
    checks.payment = "not configured";
    // Not a failure - payment is optional until deploy
  }

  return NextResponse.json(checks, { status: hasFailure ? 503 : 200 });
}
