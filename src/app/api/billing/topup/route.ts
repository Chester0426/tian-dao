import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError, getSafeOrigin } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const topupSchema = z.object({
  amount_cents: z
    .number()
    .int()
    .min(1000, "Minimum top-up is $10")
    .max(50000, "Maximum top-up is $500"),
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
    const rateLimited = checkRateLimit(`topup:${user.id}`, 5);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { amount_cents } = topupSchema.parse(body);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Assayer PAYG Top-Up" },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        plan: "topup",
        amount_cents: String(amount_cents),
      },
      success_url: `${getSafeOrigin(request)}/settings?topup=success`,
      cancel_url: `${getSafeOrigin(request)}/settings?topup=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
