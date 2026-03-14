import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasTableCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/research/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]/research", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("research_results", { data: [], error: null });
  });

  it("returns research list for owned experiment", async () => {
    setResult("research_results", {
      data: [{ id: "r-1", query: "Market viable?" }],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/research"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("research");
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-missing/research"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
  });

  it("queries research_results table", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research"
    );
    await GET(request, dummyContext);
    expect(wasTableCalled("research_results")).toBe(true);
  });
});

describe("POST /api/experiments/[id]/research", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("research_results", {
      data: {
        id: "r-new",
        query: "Test",
        summary: "Summary",
        confidence: "high",
        verdict: "confirmed",
      },
      error: null,
    });
  });

  it("creates research result with valid input and returns 201", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "Is the market viable?",
          summary: "Yes, based on data",
          confidence: "high",
          verdict: "confirmed",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("research");
  });

  it("rejects query exceeding 1000 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "a".repeat(1001),
          summary: "valid",
          confidence: "medium",
          verdict: "inconclusive",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects invalid confidence value", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "valid",
          summary: "valid",
          confidence: "invalid",
          verdict: "confirmed",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects invalid verdict value", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "valid",
          summary: "valid",
          confidence: "high",
          verdict: "maybe",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("validates hypothesis_id as UUID when provided", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "valid",
          summary: "valid",
          confidence: "high",
          verdict: "confirmed",
          hypothesis_id: "not-a-uuid",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("accepts valid hypothesis_id UUID", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/research",
      {
        method: "POST",
        body: JSON.stringify({
          query: "valid",
          summary: "valid",
          confidence: "high",
          verdict: "confirmed",
          hypothesis_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
  });
});
