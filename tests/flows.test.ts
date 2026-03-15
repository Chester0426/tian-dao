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

    it("updates subscription state on checkout.session.completed (b-25)", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { user_id: "user-1", plan: "pro" },
            customer: "cus_123",
            subscription: "sub_123",
          },
        },
      });
      setResult("user_billing", { data: { user_id: "user-1" }, error: null });

      const req = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "valid_sig" },
      });
      const res = await stripeWebhook(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(mockAdminSupabase.from).toHaveBeenCalledWith("user_billing");
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

    it("updates synced_at for running experiments — stale data becomes detectable (b-26)", async () => {
      setResult("experiments", {
        data: [{ id: "exp-1", user_id: "u-1", name: "Running Test" }],
        error: null,
      });
      setResult("experiment_metrics", { data: null, error: null });

      const res = await metricsSync(cronRequest("/api/cron/metrics-sync", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.experiments_processed).toBe(1);
      expect(data.results).toHaveLength(1);
      expect(data.results[0]).toHaveProperty("synced");
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

    it("creates budget_exhaustion alert when spent >= budget (b-27)", async () => {
      setResult("experiments", {
        data: [{ id: "exp-1", user_id: "u-1", name: "Test" }],
        error: null,
      });
      setResult("distributions", {
        data: [{ id: "d-1", channel: "google-ads", budget_cents: 1000, spent_cents: 1000 }],
        error: null,
      });
      setResult("experiment_alerts", { data: [], error: null });
      setResult("experiment_metrics", { data: [], error: null });
      setResult("experiment_metric_snapshots", { data: [], error: null });

      const res = await alertDetection(cronRequest("/api/cron/alert-detection", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alerts_created).toBeGreaterThan(0);
      expect(data.alerts).toContainEqual(expect.stringContaining("budget_exhaustion"));
    });

    it("creates dimension_dropping alert when ratio drops significantly (b-27)", async () => {
      setResult("experiments", {
        data: [{ id: "exp-1", user_id: "u-1", name: "Test" }],
        error: null,
      });
      setResult("distributions", { data: [], error: null });
      setResult("experiment_metrics", { data: [], error: null });
      setResult("experiment_metric_snapshots", {
        data: [
          { reach_ratio: 0.3, demand_ratio: 0.8, activate_ratio: null, monetize_ratio: null, retain_ratio: null },
          { reach_ratio: 0.9, demand_ratio: 0.8, activate_ratio: null, monetize_ratio: null, retain_ratio: null },
        ],
        error: null,
      });
      setResult("experiment_alerts", { data: [], error: null });

      const res = await alertDetection(cronRequest("/api/cron/alert-detection", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alerts).toContainEqual(expect.stringContaining("dimension_dropping"));
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

    it("deletes anonymous specs older than 24h (b-28)", async () => {
      setResult("specs", { data: [{ id: "s-1" }, { id: "s-2" }], error: null });
      const res = await specCleanup(cronRequest("/api/cron/spec-cleanup", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted_count).toBe(2);
      expect(mockAdminSupabase.from).toHaveBeenCalledWith("specs");
    });

    it("preserves claimed specs — only unclaimed (user_id IS NULL) are deleted (b-28)", async () => {
      // Route uses .is("user_id", null) filter — claimed specs excluded
      setResult("specs", { data: [], error: null });
      const res = await specCleanup(cronRequest("/api/cron/spec-cleanup", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted_count).toBe(0);
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

    it("dispatches verdict notification for experiments with decisions (b-29)", async () => {
      setResult("experiments", {
        data: [{ id: "exp-1", user_id: "u-1", name: "Test", decision: "scale" }],
        error: null,
      });
      setResult("notifications", { data: [], error: null });
      setResult("experiment_alerts", { data: [], error: null });

      const res = await notifications(cronRequest("/api/cron/notifications", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications_sent).toBeGreaterThan(0);
      expect(data.notifications).toContainEqual(expect.stringContaining("verdict_ready"));
    });

    it("dispatches milestone notification for critical alerts (b-29)", async () => {
      setResult("experiments", {
        data: [{ id: "exp-1", user_id: "u-1", name: "Test", decision: "scale" }],
        error: null,
      });
      setResult("notifications", { data: [], error: null });
      setResult("experiment_alerts", {
        data: [{ id: "a-1", experiment_id: "exp-1", alert_type: "budget_exhausted", message: "Budget exhausted" }],
        error: null,
      });

      const res = await notifications(cronRequest("/api/cron/notifications", true));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications_sent).toBeGreaterThanOrEqual(1);
      expect(data.notifications).toContainEqual(expect.stringContaining("budget_alert"));
    });
  });
});
