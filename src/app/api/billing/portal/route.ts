import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError, getSafeOrigin } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

// TODO: Add production rate limiting (e.g., Upstash Redis)

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit by user ID
    const rateLimited = checkRateLimit(`portal:${user.id}`, 5);
    if (rateLimited) return rateLimited;

    // Look up the user's Stripe customer ID
    const { data: billing } = await supabase
      .from("user_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe to a plan first." },
        { status: 404 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${getSafeOrigin(request)}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
