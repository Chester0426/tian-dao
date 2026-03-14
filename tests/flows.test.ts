import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret";

// b-25: Stripe webhook handler
describe("payment-fulfillment (b-25)", () => {
  const hasStripeSecret = !!process.env.STRIPE_WEBHOOK_SECRET;

  it.skipIf(!hasStripeSecret)("webhook rejects missing signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing signature");
  });

  it.skipIf(!hasStripeSecret)("webhook rejects invalid signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid_signature_value",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid signature");
  });
});

// b-26: Metrics sync cron
describe("metrics-sync (b-26)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/metrics-sync`);
    expect(res.status).toBe(401);
  });

  it("syncs metrics with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/metrics-sync`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    // Should succeed (may process 0 experiments if none are running)
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("synced_at");
    expect(data).toHaveProperty("experiments_processed");
  });
});

// b-27: Alert detection cron
describe("alert-detection (b-27)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/alert-detection`);
    expect(res.status).toBe(401);
  });

  it("detects alerts with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/alert-detection`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("checked_at");
    expect(data).toHaveProperty("experiments_checked");
  });
});

// b-28: Anonymous spec cleanup cron
describe("spec-cleanup (b-28)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/spec-cleanup`);
    expect(res.status).toBe(401);
  });

  it("cleans up old specs with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/spec-cleanup`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("cleaned_at");
    expect(data).toHaveProperty("deleted_count");
  });
});

// b-29: Notification dispatch cron
describe("notification-dispatch (b-29)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/notifications`);
    expect(res.status).toBe(401);
  });

  it("dispatches notifications with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/notifications`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("dispatched_at");
    expect(data).toHaveProperty("notifications_sent");
  });
});
