import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createInsightSchema,
  INSIGHT_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments/[id]/insights — list experiment decisions
export const GET = withErrorHandler(
  await withAuth(async (_request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    // Verify experiment ownership
    const { data: experiment } = await supabase
      .from("experiments")
      .select("id, current_round")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) {
      throw new ApiError("not_found", "Experiment not found");
    }

    const { data, error } = await supabase
      .from("experiment_decisions")
      .select(INSIGHT_COLUMNS)
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch insights");
    }

    return NextResponse.json({ insights: data ?? [] });
  })
);

// POST /api/experiments/[id]/insights — store a new decision
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    // Verify experiment ownership
    const { data: experiment } = await supabase
      .from("experiments")
      .select("id, current_round")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) {
      throw new ApiError("not_found", "Experiment not found");
    }

    const body = await request.json();
    const insight = createInsightSchema.parse(body);

    const row = {
      experiment_id: id,
      round_number: insight.round_number ?? experiment.current_round,
      decision: insight.decision,
      reasoning: insight.reasoning,
      next_steps: insight.next_steps,
    };

    const { data, error } = await supabase
      .from("experiment_decisions")
      .insert(row)
      .select(INSIGHT_COLUMNS)
      .single();

    if (error) {
      throw new ApiError("internal_error", "Failed to create insight");
    }

    return NextResponse.json({ insight: data }, { status: 201 });
  })
);
