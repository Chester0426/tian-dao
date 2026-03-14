import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { handleApiError } from "@/lib/api-error";

// GET /api/spec/[id] — get a single spec by ID (requires session_token query param)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Require session_token as proof of ownership
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("session_token");
    if (!sessionToken) {
      return NextResponse.json({ error: "session_token query parameter required" }, { status: 400 });
    }

    // Use admin client to bypass RLS; access control is via session_token match
    const adminSupabase = createAdminSupabaseClient();

    const { data, error } = await adminSupabase
      .from("anonymous_specs")
      .select("id, idea_text, spec_data, preflight_results, created_at, expires_at")
      .eq("id", id)
      .eq("session_token", sessionToken)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    }

    // Return spec_data fields at top level for launch page consumption
    const specData = (data.spec_data as Record<string, unknown>) ?? {};
    return NextResponse.json({
      id: data.id,
      title: (specData.title as string) ?? data.idea_text ?? "Untitled Spec",
      description: (specData.description as string) ?? "",
      stack: (specData.stack as unknown[]) ?? [],
      behaviors: (specData.behaviors as unknown[]) ?? [],
      variants: (specData.variants as unknown[]) ?? [],
      hypotheses: (specData.hypotheses as unknown[]) ?? [],
      idea_text: data.idea_text,
      created_at: data.created_at,
      expires_at: data.expires_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
