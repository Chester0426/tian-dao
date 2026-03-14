import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasMethodCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import(
  "@/app/api/experiments/[id]/variants/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]/variants", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("variants", { data: [], error: null });
  });

  it("returns variants list for owned experiment", async () => {
    setResult("variants", {
      data: [{ id: "v-1", slug: "control" }],
      error: null,
    });

    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("variants");
  });

  it("returns 404 for non-existent experiment", async () => {
    setResult("experiments", { data: null, error: null });

    const request = new Request(
      "http://localhost/api/experiments/exp-missing/variants"
    );
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/experiments/[id]/variants", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", current_round: 1 },
      error: null,
    });
    setResult("variants", {
      data: [{ id: "v-1", slug: "test" }],
      error: null,
    });
  });

  it("creates variants in append mode by default", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants",
      {
        method: "POST",
        body: JSON.stringify([
          { slug: "test", headline: "Test H", cta: "Click" },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("variants");
    expect(wasMethodCalled("variants", "delete")).toBe(false);
  });

  it("deletes existing before inserting in replace mode", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants?mode=replace",
      {
        method: "POST",
        body: JSON.stringify([
          { slug: "new", headline: "New", cta: "Go" },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    expect(wasMethodCalled("variants", "delete")).toBe(true);
  });

  it("rejects empty array", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants",
      {
        method: "POST",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects slug exceeding 50 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants",
      {
        method: "POST",
        body: JSON.stringify([
          { slug: "a".repeat(51), headline: "Test", cta: "Click" },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects headline exceeding 200 chars", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants",
      {
        method: "POST",
        body: JSON.stringify([
          { slug: "v1", headline: "a".repeat(201), cta: "Click" },
        ]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const request = new Request(
      "http://localhost/api/experiments/exp-123/variants",
      {
        method: "POST",
        body: JSON.stringify([{ slug: "v1" }]),
        headers: { "Content-Type": "application/json" },
      }
    );

    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });
});
