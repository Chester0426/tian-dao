import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Error handler wrapper — catches errors, returns structured JSON responses
// ---------------------------------------------------------------------------
export function withErrorHandler(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>
) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("API error:", error);
      // Never leak internal error details to the client
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// ---------------------------------------------------------------------------
// Auth wrapper — verifies user session before processing request
// ---------------------------------------------------------------------------
export function withAuth(
  handler: (
    request: Request,
    context: { params: Promise<Record<string, string>> },
    user: User
  ) => Promise<Response>
) {
  return withErrorHandler(async (request, context) => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, context, user);
  });
}
