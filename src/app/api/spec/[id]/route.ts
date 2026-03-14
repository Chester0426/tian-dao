import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

// GET /api/spec/[id] — get a single spec by ID
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("specs")
      .select("id, user_id, idea_text, spec_data, status, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
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
      status: data.status,
      created_at: data.created_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
