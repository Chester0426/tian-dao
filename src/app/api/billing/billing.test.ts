import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog } = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const mockCheckoutCreate = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session" });
const mockPortalCreate = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/portal" });

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
}));

const { POST: subscribe } = await import("@/app/api/billing/subscribe/route");
const { POST: topup } = await import("@/app/api/billing/topup/route");
const { POST: portal } = await import("@/app/api/billing/portal/route");

function makeRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
  });
}

describe("POST /api/billing/subscribe (b-23)", () => {
  beforeEach(() => {
    clearLog();
  });

  it("creates a valid Stripe subscription checkout session", async () => {
    const res = await subscribe(makeRequest("/api/billing/subscribe", { plan: "pro" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("url");
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" })
    );
  });

  it("rejects unauthenticated subscribe requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await subscribe(makeRequest("/api/billing/subscribe", { plan: "pro" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/billing/topup (b-23)", () => {
  beforeEach(() => {
    clearLog();
  });

  it("creates a valid PAYG top-up checkout ($10-$500)", async () => {
    const res = await topup(makeRequest("/api/billing/topup", { amount_cents: 1000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("url");
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment" })
    );
  });

  it("rejects top-up below $10", async () => {
    const res = await topup(makeRequest("/api/billing/topup", { amount_cents: 500 }));
    expect(res.status).toBe(400);
  });

  it("rejects top-up above $500", async () => {
    const res = await topup(makeRequest("/api/billing/topup", { amount_cents: 60000 }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/billing/portal (b-23)", () => {
  beforeEach(() => {
    clearLog();
  });

  it("redirects to Stripe billing management portal", async () => {
    setResult("user_billing", {
      data: { stripe_customer_id: "cus_123" },
      error: null,
    });
    const res = await portal(
      new Request("http://localhost/api/billing/portal", {
        method: "POST",
        headers: { Origin: "http://localhost" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("url");
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123" })
    );
  });

  it("returns 404 when no billing account exists", async () => {
    setResult("user_billing", { data: null, error: null });
    const res = await portal(
      new Request("http://localhost/api/billing/portal", {
        method: "POST",
        headers: { Origin: "http://localhost" },
      })
    );
    expect(res.status).toBe(404);
  });
});
