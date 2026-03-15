import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";

// User client — used by withAuth for auth and by route for experiment/hypothesis/variant inserts
const { mockSupabase: mockUserSupabase, setResult: setUserResult, clearLog: clearUserLog, wasTableCalled: wasUserTableCalled } =
  createMockSupabase();

// Admin client — used for anonymous_specs (RLS bypass)
const { mockSupabase: mockAdminSupabase, setResult: setAdminResult, clearLog: clearAdminLog, wasMethodCalled: wasAdminMethodCalled } =
  createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockUserSupabase),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: vi.fn(() => mockAdminSupabase),
}));

const { POST } = await import("@/app/api/spec/claim/route");

const dummyContext = { params: Promise.resolve({}) };

const VALID_SESSION_TOKEN = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const SAMPLE_SPEC_DATA = {
  name: "My Experiment",
  experiment_type: "web-app",
  level: 2,
  hypotheses: [
    {
      id: "h-1",
      category: "demand",
      statement: "Users want this",
      metric: "signups > 100",
      priority_score: 0.8,
      experiment_level: 1,
      depends_on: null,
    },
  ],
  variants: [
    {
      slug: "control",
      headline: "Control Headline",
      subheadline: "Control Sub",
      cta: "Sign Up",
      pain_points: ["pain1"],
      promise: "We promise value",
      proof: "Social proof",
      urgency: "Limited time",
    },
  ],
};

describe("POST /api/spec/claim", () => {
  beforeEach(() => {
    clearUserLog();
    clearAdminLog();
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      // Override auth to return no user
      mockUserSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(request, dummyContext);
      expect(res.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 when session_token is missing", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(request, dummyContext);
      expect(res.status).toBe(400);
    });

    it("returns 400 when session_token is not a valid UUID", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: "not-a-uuid" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(request, dummyContext);
      expect(res.status).toBe(400);
    });
  });

  describe("not found", () => {
    it("returns 404 when no anonymous_spec found for session_token", async () => {
      setAdminResult("anonymous_specs", { data: null, error: { message: "not found" } });

      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(request, dummyContext);
      expect(res.status).toBe(404);
    });
  });

  describe("success", () => {
    beforeEach(() => {
      setAdminResult("anonymous_specs", {
        data: {
          id: "anon-spec-1",
          idea_text: "Test idea",
          spec_data: SAMPLE_SPEC_DATA,
          preflight_results: null,
          session_token: VALID_SESSION_TOKEN,
        },
        error: null,
      });
      setUserResult("experiments", {
        data: { id: "exp-new-123" },
        error: null,
      });
      setUserResult("experiment_hypotheses", {
        data: [{ id: "eh-1" }],
        error: null,
      });
      setUserResult("experiment_variants", {
        data: [{ id: "ev-1" }],
        error: null,
      });
    });

    it("returns 200 with experiment_id on success", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(request, dummyContext);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("experiment_id");
      expect(body.experiment_id).toBe("exp-new-123");
    });

    it("deletes the anonymous_spec row after claiming", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      await POST(request, dummyContext);
      expect(wasAdminMethodCalled("anonymous_specs", "delete")).toBe(true);
    });

    it("inserts hypotheses from spec_data", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      await POST(request, dummyContext);
      expect(wasUserTableCalled("experiment_hypotheses")).toBe(true);
    });

    it("inserts variants from spec_data", async () => {
      const request = new Request("http://localhost/api/spec/claim", {
        method: "POST",
        body: JSON.stringify({ session_token: VALID_SESSION_TOKEN }),
        headers: { "Content-Type": "application/json" },
      });

      await POST(request, dummyContext);
      expect(wasUserTableCalled("experiment_variants")).toBe(true);
    });
  });
});
