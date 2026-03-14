import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { trackServerEvent } from "@/lib/analytics-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// TODO: Add production rate limiting (e.g., Upstash Redis)

// b-25: POST /api/webhooks/stripe — Stripe webhook handler
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id ?? "unknown";
      const plan = session.metadata?.plan ?? "pro";
      const amountCents = Number(session.metadata?.amount_cents ?? 0);

      // Update user billing record — upsert to handle first-time and returning customers
      await supabase.from("user_billing").upsert(
        {
          user_id: userId,
          plan: plan === "topup" ? undefined : plan,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
          subscription_status: "active",
        },
        { onConflict: "user_id" }
      );

      await trackServerEvent("pay_success", userId, {
        plan,
        amount_cents: amountCents,
        provider: "stripe",
      });

      await trackServerEvent("payment_complete", userId, {
        plan,
        amount_cents: amountCents,
        provider: "stripe",
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : null;

      if (customerId) {
        // Find user by stripe_customer_id and update subscription state
        const { data: billing } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (billing) {
          const periodEnd = subscription.current_period_end;
          await supabase
            .from("user_billing")
            .update({
              stripe_subscription_id: subscription.id as string,
              subscription_status: subscription.status as string,
              current_period_end: typeof periodEnd === "number"
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("user_id", billing.user_id);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : null;

      if (customerId) {
        const { data: billing } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (billing) {
          await supabase
            .from("user_billing")
            .update({
              plan: "free",
              subscription_status: "canceled",
              stripe_subscription_id: null,
            })
            .eq("user_id", billing.user_id);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : null;

      if (customerId) {
        const { data: billing } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (billing) {
          await supabase
            .from("user_billing")
            .update({ subscription_status: "past_due" })
            .eq("user_id", billing.user_id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
