import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog } = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/distribution/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("distribution campaigns (b-24)", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", { data: { id: "exp-123" }, error: null });
  });

  it("lists campaigns for an experiment (CRUD — GET)", async () => {
    setResult("distribution_campaigns", {
      data: [
        {
          id: "dc-1",
          channel: "google-ads",
          campaign_name: "Test Campaign",
          status: "draft",
          metrics_synced_at: null,
        },
      ],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/distribution"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("campaigns");
    expect(body.campaigns).toHaveLength(1);
  });

  it("creates a campaign with valid input (CRUD — POST)", async () => {
    setResult("distribution_campaigns", {
      data: {
        id: "dc-2",
        channel: "google-ads",
        campaign_name: "New Campaign",
        budget_cents: 5000,
        status: "draft",
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/distribution",
      {
        method: "POST",
        body: JSON.stringify({
          channel: "google-ads",
          campaign_name: "New Campaign",
          budget_cents: 5000,
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "test-campaign",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.campaign).toHaveProperty("id");
    expect(body.campaign.status).toBe("draft");
  });

  it("tracks sync status per channel via metrics_synced_at", async () => {
    const syncedAt = new Date().toISOString();
    setResult("distribution_campaigns", {
      data: [
        { id: "dc-1", channel: "google-ads", metrics_synced_at: syncedAt, status: "active" },
        { id: "dc-2", channel: "meta-ads", metrics_synced_at: null, status: "draft" },
      ],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/distribution"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Each campaign tracks its own sync status
    expect(body.campaigns[0].metrics_synced_at).toBe(syncedAt);
    expect(body.campaigns[1].metrics_synced_at).toBeNull();
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });
    const request = new Request(
      "http://localhost/api/experiments/missing/distribution"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
  });
});
