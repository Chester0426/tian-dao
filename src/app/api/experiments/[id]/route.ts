import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  updateExperimentSchema,
  EXPERIMENT_DETAIL_COLUMNS,
} from "@/lib/experiment-schemas";
import type { ExperimentStatus } from "@/lib/types";

// Valid status transitions per product-design.md
const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["active", "archived"],
  active: ["paused", "verdict_ready", "archived"],
  paused: ["active", "archived"],
  verdict_ready: ["completed", "draft", "archived"],
  completed: ["archived"],
  archived: [],
};

// GET /api/experiments/[id] — get single experiment with latest round
export const GET = withErrorHandler(
  await withAuth(async (_request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: experiment, error } = await supabase
      .from("experiments")
      .select(EXPERIMENT_DETAIL_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !experiment) {
      throw new ApiError("not_found", "Experiment not found");
    }

    // Fetch latest round
    const { data: latestRound } = await supabase
      .from("experiment_rounds")
      .select("round_number, spec_snapshot, decision, bottleneck_dimension")
      .eq("experiment_id", id)
      .order("round_number", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      experiment: {
        ...experiment,
        latest_round: latestRound ?? null,
      },
    });
  })
);

// PATCH /api/experiments/[id] — update experiment
export const PATCH = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const body = await request.json();
    const updates = updateExperimentSchema.parse(body);

    // Only include defined fields in the update
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      throw new ApiError("validation_error", "No fields to update");
    }

    const supabase = await createServerSupabaseClient();

    // Validate status transition if status is being changed
    if (cleanUpdates.status) {
      const { data: current, error: fetchError } = await supabase
        .from("experiments")
        .select("status")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !current) {
        throw new ApiError("not_found", "Experiment not found");
      }

      const currentStatus = current.status as ExperimentStatus;
      const newStatus = cleanUpdates.status as ExperimentStatus;
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

      if (!allowed.includes(newStatus)) {
        throw new ApiError(
          "validation_error",
          `Cannot transition from "${currentStatus}" to "${newStatus}"`
        );
      }
    }

    const { data, error } = await supabase
      .from("experiments")
      .update(cleanUpdates)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .select(EXPERIMENT_DETAIL_COLUMNS)
      .single();

    if (error || !data) {
      throw new ApiError("not_found", "Experiment not found");
    }

    return NextResponse.json({ experiment: data });
  })
);

// DELETE /api/experiments/[id] — soft delete (set archived_at)
export const DELETE = withErrorHandler(
  await withAuth(async (_request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("experiments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .select("id")
      .single();

    if (error || !data) {
      throw new ApiError("not_found", "Experiment not found");
    }

    return NextResponse.json({ deleted: true });
  })
);
