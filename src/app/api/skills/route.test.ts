import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

const { mockSupabase, setResult, clearLog } = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const { POST, GET } = await import("@/app/api/skills/route");
const { POST: approveSkill } = await import(
  "@/app/api/skills/[id]/approve/route"
);

const EXP_UUID = "11111111-1111-4111-a111-111111111111";

describe("POST /api/skills — skill execution (b-20)", () => {
  beforeEach(() => {
    clearLog();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "test@example.com", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
      },
      error: null,
    });
    setResult("experiments", { data: { id: "exp-1" }, error: null });
    setResult("user_billing", { data: { plan: "pro", payg_balance_cents: 0 }, error: null });
    setResult("skill_executions", {
      data: { id: "se-1", skill_name: "iterate", status: "pending", created_at: new Date().toISOString() },
      error: null,
    });
  });

  it("starts skill execution and returns a job ID (b-20)", async () => {
    const request = new Request("http://localhost/api/skills", {
      method: "POST",
      body: JSON.stringify({ experiment_id: EXP_UUID, skill_name: "iterate" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.execution).toHaveProperty("id");
    expect(body.execution).toHaveProperty("status");
  });

  it("rejects unauthorized requests with 401 (b-20)", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const request = new Request("http://localhost/api/skills", {
      method: "POST",
      body: JSON.stringify({ experiment_id: EXP_UUID, skill_name: "iterate" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request);
    expect(res.status).toBe(401);
  });
});

describe("skill approval gate (b-21)", () => {
  beforeEach(() => {
    clearLog();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "test@example.com", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
      },
      error: null,
    });
    setResult("experiments", { data: { id: "exp-1" }, error: null });
    setResult("user_billing", { data: { plan: "pro", payg_balance_cents: 0 }, error: null });
  });

  it("approval-gated skills (deploy) start with paused status (b-21)", async () => {
    setResult("skill_executions", {
      data: { id: "se-2", skill_name: "deploy", status: "paused", created_at: new Date().toISOString() },
      error: null,
    });
    const request = new Request("http://localhost/api/skills", {
      method: "POST",
      body: JSON.stringify({ experiment_id: EXP_UUID, skill_name: "deploy" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.execution.status).toBe("paused");
  });

  it("user can approve a pending skill execution (b-21)", async () => {
    setResult("skill_executions", {
      data: { id: "se-2", skill_name: "deploy", status: "pending", started_at: new Date().toISOString() },
      error: null,
    });
    const request = new Request("http://localhost/api/skills/se-2/approve", {
      method: "POST",
      body: JSON.stringify({ action: "approve" }),
      headers: { "Content-Type": "application/json" },
    });
    const context = { params: Promise.resolve({ id: "se-2" }) };
    const res = await approveSkill(request, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.execution).toHaveProperty("id");
  });

  it("user can reject a pending skill execution (b-21)", async () => {
    setResult("skill_executions", {
      data: { id: "se-2", skill_name: "deploy", status: "failed", started_at: null },
      error: null,
    });
    const request = new Request("http://localhost/api/skills/se-2/approve", {
      method: "POST",
      body: JSON.stringify({ action: "reject" }),
      headers: { "Content-Type": "application/json" },
    });
    const context = { params: Promise.resolve({ id: "se-2" }) };
    const res = await approveSkill(request, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.execution).toHaveProperty("id");
  });
});

describe("billing enforcement (b-22)", () => {
  beforeEach(() => {
    clearLog();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "test@example.com", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
      },
      error: null,
    });
    setResult("experiments", { data: { id: "exp-1" }, error: null });
  });

  it("blocks free-tier users from Pro-only operations (b-22)", async () => {
    setResult("user_billing", { data: { plan: "payg", payg_balance_cents: 0 }, error: null });
    setResult("skill_executions", {
      data: { id: "se-1", skill_name: "deploy", status: "paused", created_at: new Date().toISOString() },
      error: null,
    });
    const request = new Request("http://localhost/api/skills", {
      method: "POST",
      body: JSON.stringify({ experiment_id: EXP_UUID, skill_name: "deploy" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request);
    expect(res.status).toBe(403);
  });

  it("allows Pro users to access all operations (b-22)", async () => {
    setResult("user_billing", { data: { plan: "pro", payg_balance_cents: 0 }, error: null });
    setResult("skill_executions", {
      data: { id: "se-1", skill_name: "deploy", status: "paused", created_at: new Date().toISOString() },
      error: null,
    });
    const request = new Request("http://localhost/api/skills", {
      method: "POST",
      body: JSON.stringify({ experiment_id: EXP_UUID, skill_name: "deploy" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request);
    expect(res.status).toBe(201);
  });
});
