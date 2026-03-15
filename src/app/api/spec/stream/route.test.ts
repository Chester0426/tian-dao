import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase } from "@/test-utils/mock-supabase";
import { _resetStore } from "@/lib/rate-limit";

// Admin client — used for anonymous_specs (RLS bypass) and regenerate check
const {
  mockSupabase: mockAdminSupabase,
  setResult: setAdminResult,
  clearLog: clearAdminLog,
} = createMockSupabase();

// User client — used for optional auth check
const {
  mockSupabase: mockUserSupabase,
  clearLog: clearUserLog,
} = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue(mockUserSupabase),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: vi.fn(() => mockAdminSupabase),
}));

// Mock AI stream — returns an async iterable that yields no events by default
const mockAiStream = vi.fn().mockResolvedValue({
  async *[Symbol.asyncIterator]() {
    // yield nothing — tests that need AI output override this
  },
});

vi.mock("@/lib/ai", () => ({
  stream: mockAiStream,
}));

const { POST } = await import("@/app/api/spec/stream/route");

const VALID_SESSION_TOKEN = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_IDEA = "A platform that helps indie hackers validate their startup ideas quickly";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/spec/stream", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/spec/stream", () => {
  let origDemoMode: string | undefined;
  let origApiKey: string | undefined;

  beforeEach(() => {
    clearAdminLog();
    clearUserLog();
    _resetStore();
    // Save original env
    origDemoMode = process.env.DEMO_MODE;
    origApiKey = process.env.ANTHROPIC_API_KEY;
    // Default: anonymous user (no auth)
    mockUserSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    // Default admin result for upsert
    setAdminResult("anonymous_specs", {
      data: { id: "anon-spec-1" },
      error: null,
    });
    // Enable DEMO_MODE by default so tests pass the API key check
    process.env.DEMO_MODE = "true";
  });

  afterEach(() => {
    // Restore original env
    if (origDemoMode !== undefined) {
      process.env.DEMO_MODE = origDemoMode;
    } else {
      delete process.env.DEMO_MODE;
    }
    if (origApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = origApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe("validation", () => {
    it("returns 400 when idea is missing", async () => {
      const request = makeRequest({ session_token: VALID_SESSION_TOKEN });
      const res = await POST(request);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 when idea is shorter than 20 characters", async () => {
      const request = makeRequest({
        idea: "Too short",
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.details).toBeDefined();
    });

    it("returns 400 when session_token is missing", async () => {
      const request = makeRequest({ idea: VALID_IDEA });
      const res = await POST(request);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 when session_token is not a valid UUID", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: "not-a-uuid",
      });
      const res = await POST(request);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 when idea exceeds 10000 characters", async () => {
      const request = makeRequest({
        idea: "a".repeat(10001),
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.status).toBe(400);
    });

    it("accepts valid level values (1, 2, 3)", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
        level: 2,
      });
      const res = await POST(request);
      // Should not be 400 — may be SSE or other status but not validation error
      expect(res.status).not.toBe(400);
    });

    it("returns 400 for invalid level value", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
        level: 5,
      });
      const res = await POST(request);
      expect(res.status).toBe(400);
    });
  });

  describe("SSE response", () => {
    it("returns SSE content-type header on success", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    });

    it("returns Cache-Control no-cache header", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("returns Connection keep-alive header", async () => {
      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when anonymous user exceeds rate limit", async () => {
      // Exhaust the 3-per-24h spec rate limit
      for (let i = 0; i < 3; i++) {
        const req = makeRequest({
          idea: VALID_IDEA,
          session_token: VALID_SESSION_TOKEN,
        });
        await POST(req);
      }

      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.status).toBe(429);
    });

    it("returns 429 when authenticated user exceeds rate limit", async () => {
      mockUserSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            aud: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: "",
          },
        },
        error: null,
      });

      // Exhaust the 5-per-24h authenticated rate limit
      for (let i = 0; i < 5; i++) {
        const req = makeRequest({
          idea: VALID_IDEA,
          session_token: VALID_SESSION_TOKEN,
        });
        await POST(req);
      }

      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.status).toBe(429);
    });
  });

  describe("regenerate handling", () => {
    it("returns 404 when regenerate_token does not match session_token", async () => {
      const regenerateToken = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
      setAdminResult("anonymous_specs", { data: null, error: { message: "not found" } });

      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
        regenerate_token: regenerateToken,
      });
      const res = await POST(request);
      expect(res.status).toBe(404);
    });
  });

  describe("API key check", () => {
    it("returns 503 when ANTHROPIC_API_KEY is not set and not DEMO_MODE", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.DEMO_MODE;

      const request = makeRequest({
        idea: VALID_IDEA,
        session_token: VALID_SESSION_TOKEN,
      });
      const res = await POST(request);
      expect(res.status).toBe(503);
    });
  });
});
