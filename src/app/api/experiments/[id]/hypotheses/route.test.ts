import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasMethodCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/hypotheses/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]/hypotheses", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("hypotheses", { data: [], error: null });
  });

  it("returns hypotheses list for owned experiment", async () => {
    setResult("hypotheses", {
      data: [{ id: "h-1", hypothesis_key: "h-01" }],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("hypotheses");
    expect(Array.isArray(body.hypotheses)).toBe(true);
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-missing/hypotheses"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });
});

describe("POST /api/experiments/[id]/hypotheses", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("hypotheses", {
      data: [{ id: "h-1", hypothesis_key: "h-01" }],
      error: null,
    });
  });

  it("creates hypotheses in append mode by default (no delete)", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses",
      {
        method: "POST",
        body: JSON.stringify([
          {
            hypothesis_key: "h-01",
            category: "demand",
            statement: "Users want this",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("hypotheses");
    // In append mode, delete should NOT be called on hypotheses
    expect(wasMethodCalled("hypotheses", "delete")).toBe(false);
  });

  it("deletes existing before inserting in replace mode", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses?mode=replace",
      {
        method: "POST",
        body: JSON.stringify([
          {
            hypothesis_key: "h-01",
            category: "reach",
            statement: "CTR > 2%",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    expect(wasMethodCalled("hypotheses", "delete")).toBe(true);
  });

  it("rejects empty array with validation error", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses",
      {
        method: "POST",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects hypothesis_key exceeding 50 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses",
      {
        method: "POST",
        body: JSON.stringify([
          {
            hypothesis_key: "a".repeat(51),
            category: "demand",
            statement: "valid",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects invalid category", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/hypotheses",
      {
        method: "POST",
        body: JSON.stringify([
          {
            hypothesis_key: "h-01",
            category: "invalid",
            statement: "valid",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("returns 404 when experiment not owned", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-other/hypotheses",
      {
        method: "POST",
        body: JSON.stringify([
          {
            hypothesis_key: "h-01",
            category: "demand",
            statement: "valid",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(404);
  });
});
