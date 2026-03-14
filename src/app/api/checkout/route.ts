import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/api-helpers";

// TODO: Add production rate limiting (e.g., Upstash Redis)

// Canonical plan prices — single source of truth for checkout validation
const PLAN_PRICES: Record<string, number> = {
  pro: 2900, // $29.00
};

const checkoutSchema = z.object({
  plan: z.string().min(1).max(50),
  amount_cents: z.number().int().positive(),
});

// POST /api/checkout — create Stripe checkout session
export const POST = withAuth(async (request, _context, user) => {
  const body = await request.json();
  const { plan, amount_cents } = checkoutSchema.parse(body);

  // Validate that amount_cents matches the expected price for this plan
  const expectedPrice = PLAN_PRICES[plan];
  if (expectedPrice === undefined) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (amount_cents !== expectedPrice) {
    return NextResponse.json({ error: "Price mismatch" }, { status: 400 });
  }

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
    success_url: `${request.headers.get("origin") ?? ""}/settings?billing=success`,
    cancel_url: `${request.headers.get("origin") ?? ""}/settings?billing=canceled`,
  });

  return NextResponse.json({ url: session.url });
});
