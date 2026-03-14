import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError, getSafeOrigin } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const checkoutSchema = z.object({
  plan: z.string().min(1).max(50),
  amount_cents: z.number().int().positive().max(100_000_00), // max $100,000
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
    const rateLimited = checkRateLimit(`checkout:${user.id}`, 5);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { plan, amount_cents } = checkoutSchema.parse(body);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        plan,
        amount_cents: String(amount_cents),
      },
      success_url: `${getSafeOrigin(request)}/settings?checkout=success`,
      cancel_url: `${getSafeOrigin(request)}/settings?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
