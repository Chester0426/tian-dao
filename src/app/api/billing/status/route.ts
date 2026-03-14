import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

// GET /api/billing/status — get user's subscription status
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_start, current_period_end, cancel_at_period_end, credits_cents")
      .eq("user_id", user.id)
      .single();

    if (!sub) {
      // No subscription record - return free plan defaults
      return NextResponse.json({
        plan: "free",
        status: "active",
        current_period_end: null,
        amount_cents: 0,
      });
    }

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      credits_cents: sub.credits_cents,
      amount_cents: sub.plan === "pro" ? 2900 : 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
