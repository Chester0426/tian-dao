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

    const { data: billing } = await supabase
      .from("user_billing")
      .select("plan, subscription_status, stripe_customer_id, payg_balance_cents, creates_used, modifications_used, hosting_used, pool_resets_at")
      .eq("user_id", user.id)
      .single();

    if (!billing) {
      // No billing record - return payg plan defaults
      return NextResponse.json({
        plan: "payg",
        subscription_status: "none",
        payg_balance_cents: 0,
        amount_cents: 0,
      });
    }

    return NextResponse.json({
      plan: billing.plan,
      subscription_status: billing.subscription_status,
      payg_balance_cents: billing.payg_balance_cents,
      creates_used: billing.creates_used,
      modifications_used: billing.modifications_used,
      hosting_used: billing.hosting_used,
      pool_resets_at: billing.pool_resets_at,
      amount_cents: billing.plan === "pro" ? 2900 : 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
