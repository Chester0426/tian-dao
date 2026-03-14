import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";

// b-22: GET /api/billing/status — get user's billing status
export const GET = withAuth(async (_request, _context, user) => {
  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: billing } = await supabase
    .from("user_billing")
    .select("plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end")
    .eq("user_id", user.id)
    .single();

  // Count user's experiments for usage
  const { count: experimentCount } = await supabase
    .from("experiments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const plan = billing?.plan ?? "free";

  return NextResponse.json({
    plan,
    status: billing?.subscription_status ?? null,
    current_period_end: billing?.current_period_end ?? null,
    usage: {
      experiments_used: experimentCount ?? 0,
      experiments_limit: plan === "pro" ? -1 : 3,
    },
  });
});
