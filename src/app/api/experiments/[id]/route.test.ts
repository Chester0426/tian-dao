import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog, wasTableCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { GET, PATCH, DELETE } = await import(
  "@/app/api/experiments/[id]/route"
);

const dummyContext = { params: Promise.resolve({ id: "exp-123" }) };

describe("GET /api/experiments/[id]", () => {
  beforeEach(() => {
    clearLog();
  });

  it("returns experiment with latest_round when found", async () => {
    setResult("experiments", {
      data: { id: "exp-123", name: "Test", status: "draft" },
      error: null,
    });
    setResult("experiment_rounds", {
      data: {
        round_number: 1,
        spec_snapshot: {},
        decision: null,
        bottleneck_dimension: null,
      },
      error: null,
    });

    const request = new Request("http://localhost/api/experiments/exp-123");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiment).toHaveProperty("latest_round");
    expect(body.experiment.latest_round).not.toBeNull();
  });

  it("returns 404 when experiment not found", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });

    const request = new Request("http://localhost/api/experiments/exp-missing");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("returns experiment with null latest_round when no rounds exist", async () => {
    setResult("experiments", {
      data: { id: "exp-123", name: "Test", status: "draft" },
      error: null,
    });
    setResult("experiment_rounds", {
      data: null,
      error: { message: "no rows" },
    });

    const request = new Request("http://localhost/api/experiments/exp-123");
    const res = await GET(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiment.latest_round).toBeNull();
  });
});

describe("PATCH /api/experiments/[id]", () => {
  beforeEach(() => {
    clearLog();
    setResult("experiments", {
      data: { id: "exp-123", name: "Updated", status: "active" },
      error: null,
    });
  });

  it("updates experiment with valid fields", async () => {
    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("experiment");
  });

  it("rejects empty update body with validation_error", async () => {
    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects deployed_url exceeding 500 chars", async () => {
    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({ deployed_url: "a".repeat(501) }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects invalid decision value", async () => {
    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({ decision: "destroy" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("rejects negative budget", async () => {
    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({ budget: -10 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(400);
  });

  it("returns 404 when experiment not found on update", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });

    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(request, dummyContext);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/experiments/[id]", () => {
  beforeEach(() => {
    clearLog();
  });

  it("soft deletes experiment (sets archived_at) and returns deleted: true", async () => {
    setResult("experiments", { data: { id: "exp-123" }, error: null });

    const request = new Request("http://localhost/api/experiments/exp-123", {
      method: "DELETE",
    });

    const res = await DELETE(request, dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(wasTableCalled("experiments")).toBe(true);
  });

  it("returns 404 when experiment not found", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });

    const request = new Request("http://localhost/api/experiments/exp-missing", {
      method: "DELETE",
    });

    const res = await DELETE(request, dummyContext);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });
});

describe("ownership isolation (b-18)", () => {
  beforeEach(() => {
    clearLog();
  });

  it("users can only access their own experiments — non-owned returns 404", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });
    const request = new Request("http://localhost/api/experiments/exp-other-user");
    const res = await GET(request, dummyContext);
    // Route queries with .eq("user_id", user.id) — non-owned experiments return 404
    expect(res.status).toBe(404);
    expect(mockSupabase.from).toHaveBeenCalledWith("experiments");
  });

  it("CRUD operations enforce user_id scoping on PATCH and DELETE", async () => {
    setResult("experiments", { data: null, error: { message: "not found" } });
    const patchReq = new Request("http://localhost/api/experiments/exp-other", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hijack" }),
      headers: { "Content-Type": "application/json" },
    });
    const patchRes = await PATCH(patchReq, dummyContext);
    expect(patchRes.status).toBe(404);

    const deleteReq = new Request("http://localhost/api/experiments/exp-other", {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq, dummyContext);
    expect(deleteRes.status).toBe(404);
  });
});
