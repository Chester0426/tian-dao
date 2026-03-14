import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasTableCalled, wasMethodCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/rounds/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]/rounds", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("experiment_rounds", { data: [], error: null });
  });

  it("returns rounds list for owned experiment", async () => {
    setResult("experiment_rounds", {
      data: [{ id: "r-1", round_number: 1 }],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rounds");
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-missing/rounds"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
  });

  it("queries experiment_rounds table", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds"
    );
    await GET(request, dummyContext);
    expect(wasTableCalled("experiment_rounds")).toBe(true);
  });
});

describe("POST /api/experiments/[id]/rounds", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("experiment_rounds", {
      data: {
        id: "round-new",
        round_number: 2,
        spec_snapshot: { name: "test" },
      },
      error: null,
    });
  });

  it("creates round with valid spec_snapshot and returns 201", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds",
      {
        method: "POST",
        body: JSON.stringify({
          spec_snapshot: { name: "round-2", behaviors: [] },
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("round");
  });

  it("rejects missing spec_snapshot", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects non-object spec_snapshot", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds",
      {
        method: "POST",
        body: JSON.stringify({ spec_snapshot: "not an object" }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("returns 404 when experiment not owned", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-other/rounds",
      {
        method: "POST",
        body: JSON.stringify({ spec_snapshot: { name: "test" } }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(404);
  });

  it("updates experiment current_round after creating round", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/rounds",
      {
        method: "POST",
        body: JSON.stringify({ spec_snapshot: { name: "round-2" } }),
        headers: { "Content-Type": "application/json" },
      }
    );

    await POST(request, dummyContext);
    // Verify update was called on experiments table (to increment current_round)
    expect(wasMethodCalled("experiments", "update")).toBe(true);
  });
});
