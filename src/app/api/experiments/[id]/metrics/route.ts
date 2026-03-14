import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/experiments/[id]/metrics — list metrics for an experiment
export const GET = withErrorHandler(
  await withAuth(async (_request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: experiment } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) throw new ApiError("not_found", "Experiment not found");

    const { data, error } = await supabase
      .from("experiment_metric_snapshots")
      .select("id, round_number, reach_ratio, demand_ratio, activate_ratio, monetize_ratio, retain_ratio, total_clicks, total_spend_cents, posthog_synced_at, distribution_synced_at, created_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError("internal_error", "Failed to fetch metrics");

    return NextResponse.json({ metrics: data });
  })
);
