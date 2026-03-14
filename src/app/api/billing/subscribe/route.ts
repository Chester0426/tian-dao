import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/api-helpers";
import { trackServerEvent } from "@/lib/analytics-server";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const subscribeSchema = z.object({
  plan: z.string().min(1).max(50),
});

// b-23: POST /api/billing/subscribe — create Stripe subscription checkout
export const POST = withAuth(async (request, _context, user) => {
  const body = await request.json();
  const { plan } = subscribeSchema.parse(body);

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Assayer ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan` },
          unit_amount: 2900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      plan,
      amount_cents: "2900",
    },
    success_url: `${request.headers.get("origin") ?? ""}/settings?billing=success`,
    cancel_url: `${request.headers.get("origin") ?? ""}/settings?billing=canceled`,
  });

  await trackServerEvent("checkout_started", user.id, {
    plan,
    amount_cents: 2900,
  });

  return NextResponse.json({ url: session.url });
});
