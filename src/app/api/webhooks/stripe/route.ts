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
        // PAYG top-up: add balance to user's billing
        const { data: existingBilling } = await supabase
          .from("user_billing")
          .select("user_id, payg_balance_cents")
          .eq("user_id", userId)
          .single();

        if (existingBilling) {
          await supabase
            .from("user_billing")
            .update({
              payg_balance_cents: (existingBilling.payg_balance_cents ?? 0) + amountCents,
              stripe_customer_id: session.customer as string ?? null,
            })
            .eq("user_id", userId);
        } else {
          await supabase.from("user_billing").insert({
            user_id: userId,
            stripe_customer_id: session.customer as string ?? null,
            plan: "payg",
            subscription_status: "none",
            payg_balance_cents: amountCents,
          });
        }
      } else {
        // Subscription checkout completed
        const { data: existingBilling } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("user_id", userId)
          .single();

        if (existingBilling) {
          await supabase
            .from("user_billing")
            .update({
              stripe_customer_id: session.customer as string ?? null,
              stripe_subscription_id: session.subscription as string ?? null,
              plan: "pro",
              subscription_status: "active",
            })
            .eq("user_id", userId);
        } else {
          await supabase.from("user_billing").insert({
            user_id: userId,
            stripe_customer_id: session.customer as string ?? null,
            stripe_subscription_id: session.subscription as string ?? null,
            plan: "pro",
            subscription_status: "active",
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
      const { data: billing } = await supabase
        .from("user_billing")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (billing) {
        const status = String(subscription.status ?? "active");

        await supabase
          .from("user_billing")
          .update({
            subscription_status: status === "active" ? "active"
              : status === "past_due" ? "past_due"
              : status === "canceled" ? "canceled"
              : "active",
          })
          .eq("user_id", billing.user_id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = String(subscription.customer ?? "");

      const { data: billing } = await supabase
        .from("user_billing")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (billing) {
        await supabase
          .from("user_billing")
          .update({
            plan: "payg",
            subscription_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("user_id", billing.user_id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const customerId = String(invoice.customer ?? "");

      const { data: billing } = await supabase
        .from("user_billing")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (billing) {
        await supabase
          .from("user_billing")
          .update({
            subscription_status: "past_due",
          })
          .eq("user_id", billing.user_id);

        // Create a billing notification
        await supabase.from("notifications").insert({
          user_id: billing.user_id,
          trigger_type: "budget_alert",
          channel: "email",
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
