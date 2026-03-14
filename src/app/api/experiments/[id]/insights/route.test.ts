import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasTableCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/insights/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]/insights", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("experiment_decisions", { data: [], error: null });
  });

  it("returns insights list for owned experiment", async () => {
    setResult("experiment_decisions", {
      data: [{ id: "d-1", decision: "scale" }],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("insights");
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-missing/insights"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("queries experiment_decisions table", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights"
    );
    await GET(request, dummyContext);
    expect(wasTableCalled("experiment_decisions")).toBe(true);
  });
});

describe("POST /api/experiments/[id]/insights", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("experiment_decisions", {
      data: { id: "d-new", decision: "scale" },
      error: null,
    });
  });

  it("creates insight with valid input and returns 201", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights",
      {
        method: "POST",
        body: JSON.stringify({ decision: "scale" }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("insight");
  });

  it("rejects invalid decision value", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights",
      {
        method: "POST",
        body: JSON.stringify({ decision: "destroy" }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects missing decision", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects reasoning exceeding 5000 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights",
      {
        method: "POST",
        body: JSON.stringify({
          decision: "kill",
          reasoning: "a".repeat(5001),
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects next_steps exceeding 2000 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/insights",
      {
        method: "POST",
        body: JSON.stringify({
          decision: "refine",
          next_steps: "a".repeat(2001),
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });
});
