import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

// GET /api/experiments/[id]/hypotheses — list hypotheses for an experiment
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

    const { data, error } = await supabase
      .from("experiment_hypotheses")
      .select("id, hypothesis_id, category, statement, threshold, operator, formula, status, score, created_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch hypotheses" }, { status: 500 });
    }

    return NextResponse.json({ hypotheses: data });
  } catch (error) {
    return handleApiError(error);
  }
}
