import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createHypothesesSchema,
  hypothesesModeSchema,
  HYPOTHESIS_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments/[id]/hypotheses — list hypotheses for experiment
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
      .from("hypotheses")
      .select(HYPOTHESIS_COLUMNS)
      .eq("experiment_id", id)
      .order("priority_score", { ascending: false });

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch hypotheses");
    }

    return NextResponse.json({ hypotheses: data ?? [] });
  })
);

// POST /api/experiments/[id]/hypotheses — create hypotheses
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const mode = hypothesesModeSchema.parse(
      url.searchParams.get("mode") ?? undefined
    );

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
    const hypotheses = createHypothesesSchema.parse(body);

    // mode=replace: delete existing hypotheses for current round first
    if (mode === "replace") {
      await supabase
        .from("hypotheses")
        .delete()
        .eq("experiment_id", id)
        .eq("round_number", experiment.current_round);
    }

    const rows = hypotheses.map((h) => ({
      experiment_id: id,
      round_number: experiment.current_round,
      ...h,
    }));

    const { data, error } = await supabase
      .from("hypotheses")
      .insert(rows)
      .select(HYPOTHESIS_COLUMNS);

    if (error) {
      throw new ApiError("internal_error", "Failed to create hypotheses");
    }

    return NextResponse.json({ hypotheses: data ?? [] }, { status: 201 });
  })
);
