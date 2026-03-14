import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError, getSafeOrigin } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const subscribeSchema = z.object({
  plan: z.string().min(1).max(50),
});

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
    const rateLimited = checkRateLimit(`subscribe:${user.id}`, 5);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { plan } = subscribeSchema.parse(body);

    // Create a Stripe Checkout Session in subscription mode
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Assayer ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan` },
            unit_amount: 2900, // $29/month for Pro
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        plan,
      },
      success_url: `${getSafeOrigin(request)}/settings?checkout=success`,
      cancel_url: `${getSafeOrigin(request)}/settings?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
