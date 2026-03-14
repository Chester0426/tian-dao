import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Wraps an API route handler with authentication.
 * Returns the authenticated user or a 401 response.
 */
export async function withAuth(
  handler: (
    request: Request,
    context: { params: Promise<Record<string, string>> },
    user: { id: string; email: string }
  ) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> }
  ) => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, context, {
      id: user.id,
      email: user.email ?? "",
    });
  };
}
