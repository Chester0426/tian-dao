import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

// GET /api/experiments/[id]/metrics — list metrics for an experiment
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
      .from("experiment_metric_snapshots")
      .select("id, round_number, reach_ratio, demand_ratio, activate_ratio, monetize_ratio, retain_ratio, total_clicks, total_spend_cents, posthog_synced_at, distribution_synced_at, created_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
    }

    return NextResponse.json({ metrics: data });
  } catch (error) {
    return handleApiError(error);
  }
}
