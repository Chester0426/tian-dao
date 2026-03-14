import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/api-helpers";
import { trackServerEvent } from "@/lib/analytics-server";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const topupSchema = z.object({
  amount_cents: z.number().int().min(1000, "Minimum top-up is $10").max(50000, "Maximum top-up is $500"),
});

// b-23: POST /api/billing/topup — create PAYG top-up checkout session
export const POST = withAuth(async (request, _context, user) => {
  const body = await request.json();
  const { amount_cents } = topupSchema.parse(body);

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Assayer Credits Top-Up" },
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
    success_url: `${request.headers.get("origin") ?? ""}/settings?billing=success`,
    cancel_url: `${request.headers.get("origin") ?? ""}/settings?billing=canceled`,
  });

  await trackServerEvent("checkout_started", user.id, {
    plan: "topup",
    amount_cents,
  });

  return NextResponse.json({ url: session.url });
});
