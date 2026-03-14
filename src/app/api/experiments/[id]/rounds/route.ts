import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createRoundSchema,
  ROUND_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments/[id]/rounds — list rounds
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
      .from("experiment_rounds")
      .select(ROUND_COLUMNS)
      .eq("experiment_id", id)
      .order("round_number", { ascending: true });

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch rounds");
    }

    return NextResponse.json({ rounds: data ?? [] });
  })
);

// POST /api/experiments/[id]/rounds — create new round (REFINE flow)
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    // Verify experiment ownership and get current round
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
    const { spec_snapshot } = createRoundSchema.parse(body);

    const nextRound = experiment.current_round + 1;

    // Insert new round
    const { data: round, error: roundError } = await supabase
      .from("experiment_rounds")
      .insert({
        experiment_id: id,
        round_number: nextRound,
        spec_snapshot,
      })
      .select(ROUND_COLUMNS)
      .single();

    if (roundError) {
      throw new ApiError("internal_error", "Failed to create round");
    }

    // Update experiment's current_round
    const { error: updateError } = await supabase
      .from("experiments")
      .update({ current_round: nextRound })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new ApiError(
        "internal_error",
        "Failed to update experiment round counter"
      );
    }

    return NextResponse.json({ round }, { status: 201 });
  })
);
