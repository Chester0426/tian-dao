import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

// --- Shared mock: admin supabase (all cron + webhook handlers use this) ---
const { mockSupabase: mockAdminSupabase, setResult, clearLog } =
  createMockSupabase();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: vi.fn(() => mockAdminSupabase),
}));

// --- Stripe mock ---
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

// --- Analytics mock ---
vi.mock("@/lib/analytics-server", () => ({
  trackServerEvent: vi.fn(),
}));

// --- Import handlers (Next.js handler-import pattern, no running server) ---
const { GET: metricsSync } = await import(
  "@/app/api/cron/metrics-sync/route"
);
const { GET: alertDetection } = await import(
  "@/app/api/cron/alert-detection/route"
);
const { GET: specCleanup } = await import(
  "@/app/api/cron/spec-cleanup/route"
);
const { GET: notifications } = await import(
  "@/app/api/cron/notifications/route"
);
const { POST: stripeWebhook } = await import(
  "@/app/api/webhooks/stripe/route"
);

const CRON_SECRET = "test-cron-secret";

function cronRequest(
  path: string,
  withAuth = false
): Request {
  const headers: Record<string, string> = {};
  if (withAuth) {
    headers["Authorization"] = `Bearer ${CRON_SECRET}`;
  }
  return new Request(`http://localhost${path}`, { headers });
}

describe("flows", () => {
  let origCronSecret: string | undefined;

  beforeEach(() => {
    clearLog();
    origCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
    // Default: no running experiments
    setResult("experiments", { data: [], error: null });
  });

  afterEach(() => {
    if (origCronSecret !== undefined) {
      process.env.CRON_SECRET = origCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  // --- b-25: Stripe webhook handler ---
  describe("payment-fulfillment (b-25)", () => {
    it("rejects missing signature", async () => {
      const req = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      });
      const res = await stripeWebhook(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Missing signature");
    });

    it("rejects invalid signature", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const req = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "invalid_sig" },
      });
      const res = await stripeWebhook(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid signature");
    });
  });

  // --- b-26: Metrics sync cron ---
  describe("metrics-sync (b-26)", () => {
    it("rejects unauthorized requests", async () => {
      const res = await metricsSync(cronRequest("/api/cron/metrics-sync"));
      expect(res.status).toBe(401);
    });

    it("syncs metrics with valid cron secret", async () => {
      const res = await metricsSync(
        cronRequest("/api/cron/metrics-sync", true)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("synced_at");
      expect(data).toHaveProperty("experiments_processed");
    });
  });

  // --- b-27: Alert detection cron ---
  describe("alert-detection (b-27)", () => {
    it("rejects unauthorized requests", async () => {
      const res = await alertDetection(
        cronRequest("/api/cron/alert-detection")
      );
      expect(res.status).toBe(401);
    });

    it("detects alerts with valid cron secret", async () => {
      const res = await alertDetection(
        cronRequest("/api/cron/alert-detection", true)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("checked_at");
      expect(data).toHaveProperty("experiments_checked");
    });
  });

  // --- b-28: Anonymous spec cleanup cron ---
  describe("spec-cleanup (b-28)", () => {
    it("rejects unauthorized requests", async () => {
      const res = await specCleanup(cronRequest("/api/cron/spec-cleanup"));
      expect(res.status).toBe(401);
    });

    it("cleans up old specs with valid cron secret", async () => {
      // specs table returns empty array (nothing to clean)
      setResult("specs", { data: [], error: null });
      const res = await specCleanup(
        cronRequest("/api/cron/spec-cleanup", true)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("cleaned_at");
      expect(data).toHaveProperty("deleted_count");
    });
  });

  // --- b-29: Notification dispatch cron ---
  describe("notification-dispatch (b-29)", () => {
    it("rejects unauthorized requests", async () => {
      const res = await notifications(cronRequest("/api/cron/notifications"));
      expect(res.status).toBe(401);
    });

    it("dispatches notifications with valid cron secret", async () => {
      // No experiments with decisions, no critical alerts
      setResult("experiment_alerts", { data: [], error: null });
      const res = await notifications(
        cronRequest("/api/cron/notifications", true)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("dispatched_at");
      expect(data).toHaveProperty("notifications_sent");
    });
  });
});
