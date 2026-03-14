import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/api-helpers";

// TODO: Add production rate limiting (e.g., Upstash Redis)

// b-23: POST /api/billing/portal — redirect to Stripe billing portal
export const POST = withAuth(async (request, _context, user) => {
  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: billing } = await supabase
    .from("user_billing")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!billing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe first." },
      { status: 404 }
    );
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${request.headers.get("origin") ?? ""}/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
});
