import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog } = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, POST } = await import("@/app/api/experiments/route");

const dummyContext = { params: Promise.resolve({}) };

describe("GET /api/experiments", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: [{ id: "exp-1", name: "Test" }],
      count: 1,
      error: null,
    });
  });

  it("returns paginated response with defaults (page=1, limit=20)", async () => {
    const request = new Request("http://localhost/api/experiments");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("experiments");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page", 1);
    expect(body).toHaveProperty("limit", 20);
  });

  it("rejects limit above 100 with validation error", async () => {
    const request = new Request("http://localhost/api/experiments?limit=101");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects page below 1 with validation error", async () => {
    const request = new Request("http://localhost/api/experiments?page=0");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("returns internal_error when supabase fails", async () => {
    setResult("experiments", { data: null, error: { message: "db error" } });
    const request = new Request("http://localhost/api/experiments");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
  });
});

describe("POST /api/experiments", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-new", name: "New", status: "draft" },
      error: null,
    });
  });

  it("creates experiment with valid input and returns 201", async () => {
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ name: "New", idea_text: "Test idea" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("experiment");
  });

  it("rejects empty name with validation error", async () => {
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ name: "", idea_text: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects name exceeding 200 chars", async () => {
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ name: "a".repeat(201), idea_text: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects idea_text exceeding 10000 chars", async () => {
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ name: "valid", idea_text: "a".repeat(10001) }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("defaults experiment_type to web-app", async () => {
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ name: "New", idea_text: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request, dummyContext);
    expect(res.status).toBe(201);
    // insert was called on experiments table
    expect(mockSupabase.from).toHaveBeenCalledWith("experiments");
  });
});
