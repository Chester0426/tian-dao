import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

// Mock supabase-server before importing withAuth
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const mockedCreate = vi.mocked(createServerSupabaseClient);
const dummyContext = { params: Promise.resolve({ id: "abc" }) };

function mockSupabaseAuth(user: { id: string; email: string } | null) {
  mockedCreate.mockResolvedValue({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: user ? { ...user, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" } : null },
          error: null,
        }),
    },
  } as ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never);
}

describe("withAuth", () => {
  it("calls handler with user when authenticated", async () => {
    mockSupabaseAuth({ id: "user-1", email: "test@example.com" });
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = await withAuth(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(handler).toHaveBeenCalledWith(
      expect.any(Request),
      dummyContext,
      { id: "user-1", email: "test@example.com" }
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseAuth(null);
    const handler = vi.fn();
    const wrapped = await withAuth(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(handler).not.toHaveBeenCalled();
  });
});
