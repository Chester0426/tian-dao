import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { trackServerEvent } from "@/lib/analytics-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// TODO: Add production rate limiting (e.g., Upstash Redis)

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

  const supabase = createAdminSupabaseClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id ?? "unknown";
      const plan = session.metadata?.plan ?? "";
      const amountCents = Number(session.metadata?.amount_cents ?? 0);

      if (plan === "topup") {
        // PAYG top-up: add credits to user's subscription
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id, credits_cents")
          .eq("user_id", userId)
          .single();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update({
              credits_cents: (existingSub.credits_cents ?? 0) + amountCents,
              stripe_customer_id: session.customer as string ?? existingSub.id,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        } else {
          await supabase.from("subscriptions").insert({
            user_id: userId,
            stripe_customer_id: session.customer as string ?? null,
            plan: "free",
            status: "active",
            credits_cents: amountCents,
          });
        }
      } else {
        // Subscription checkout completed
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update({
              stripe_customer_id: session.customer as string ?? null,
              stripe_subscription_id: session.subscription as string ?? null,
              plan: "pro",
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        } else {
          await supabase.from("subscriptions").insert({
            user_id: userId,
            stripe_customer_id: session.customer as string ?? null,
            stripe_subscription_id: session.subscription as string ?? null,
            plan: "pro",
            status: "active",
          });
        }
      }

      await trackServerEvent("pay_success", userId, {
        plan,
        amount_cents: amountCents,
        provider: "stripe",
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      // Cast to access subscription-specific fields
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = String(subscription.customer ?? "");

      // Find user by Stripe customer ID
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (sub) {
        const status = String(subscription.status ?? "active");
        const periodStart = subscription.current_period_start as number | undefined;
        const periodEnd = subscription.current_period_end as number | undefined;

        await supabase
          .from("subscriptions")
          .update({
            status: status === "active" ? "active"
              : status === "past_due" ? "past_due"
              : status === "trialing" ? "trialing"
              : status === "unpaid" ? "unpaid"
              : "active",
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : null,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            cancel_at_period_end: (subscription.cancel_at_period_end as boolean) ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = String(subscription.customer ?? "");

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({
            plan: "free",
            status: "canceled",
            stripe_subscription_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const customerId = String(invoice.customer ?? "");

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        // Create a billing notification
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          type: "billing",
          title: "Payment failed",
          body: "Your most recent payment failed. Please update your payment method to keep your Pro plan active.",
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
