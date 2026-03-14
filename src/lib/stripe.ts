import Stripe from "stripe";

let _stripe: Stripe | null = null;

function createDemoStripe() {
  return {
    checkout: {
      sessions: {
        create: () => Promise.resolve({ url: "/" }),
      },
    },
    webhooks: {
      constructEvent: () => ({ type: "demo", data: { object: {} } }),
    },
  } as unknown as Stripe;
}

export function getStripe(): Stripe {
  if (process.env.DEMO_MODE === "true") return createDemoStripe();
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
