import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

// GET /api/experiments/[id]/research — list research for an experiment (b-19 stub)
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

    // Verify experiment ownership
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    // Stub: research table not yet in schema
    return NextResponse.json({ research: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
