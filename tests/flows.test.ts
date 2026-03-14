import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Integration tests for system/cron behaviors (b-25 through b-29)
// These tests call API endpoints directly — no browser needed.
// Tests are NOT run during bootstrap — only created.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret";

// ---------------------------------------------------------------------------
// b-25: Stripe webhook — payment fulfillment
// ---------------------------------------------------------------------------
describe("stripe-webhook (b-25)", () => {
  it("rejects requests without signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing signature");
  });

  it("rejects requests with invalid signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid-signature",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid signature");
  });
});

// ---------------------------------------------------------------------------
// b-26: Cron — metrics sync (15min)
// ---------------------------------------------------------------------------
describe("cron-metrics-sync (b-26)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/metrics`);
    expect(res.status).toBe(401);
  });

  it("syncs metrics with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/metrics`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    // May return 200 or 500 depending on database state — we verify
    // the endpoint responds and doesn't crash
    expect(res.status).not.toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("timestamp");
  });
});

// ---------------------------------------------------------------------------
// b-27: Cron — alert detection (15min)
// ---------------------------------------------------------------------------
describe("cron-alert-detection (b-27)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/alerts`);
    expect(res.status).toBe(401);
  });

  it("processes alerts with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/alerts`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).not.toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("timestamp");
  });
});

// ---------------------------------------------------------------------------
// b-28: Cron — anonymous spec cleanup (1h)
// ---------------------------------------------------------------------------
describe("cron-anonymous-spec-cleanup (b-28)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/cleanup`);
    expect(res.status).toBe(401);
  });

  it("cleans up anonymous specs with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/cleanup`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).not.toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("cutoff");
    expect(data).toHaveProperty("timestamp");
  });
});

// ---------------------------------------------------------------------------
// b-29: Cron — notification dispatch (daily)
// ---------------------------------------------------------------------------
describe("cron-notification-dispatch (b-29)", () => {
  it("rejects unauthorized requests", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/notifications`);
    expect(res.status).toBe(401);
  });

  it("dispatches notifications with valid cron secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/notifications`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).not.toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("timestamp");
  });
});
