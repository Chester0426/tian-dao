import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const changeRequestSchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  budget_delta: z.number().optional(),
});

// POST /api/experiments/[id]/changes — submit a change request (b-09)
// Change requests are queued as skill executions. For now, budget adjustments
// are applied directly to the experiment.
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: experiment } = await supabase
      .from("experiments")
      .select("id, status, budget, budget_spent")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) throw new ApiError("not_found", "Experiment not found");

    const body = await request.json();
    const change = changeRequestSchema.parse(body);

    // Queue the change as a skill execution for tracking
    const { data: execution, error: execError } = await supabase
      .from("skill_executions")
      .insert({
        experiment_id: id,
        user_id: user.id,
        skill_name: `change:${change.type}`,
        status: "pending",
        input_params: {
          type: change.type,
          description: change.description,
          budget_delta: change.budget_delta,
        },
      })
      .select("id, skill_name, status, created_at")
      .single();

    if (execError || !execution) {
      throw new ApiError("internal_error", "Failed to queue change request");
    }

    // Apply budget adjustment immediately if provided (increment, not overwrite)
    if (change.budget_delta) {
      const newBudget = Number(experiment.budget) + change.budget_delta;
      await supabase
        .from("experiments")
        .update({ budget: newBudget })
        .eq("id", id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      change: {
        id: execution.id,
        type: change.type,
        description: change.description,
        budget_delta: change.budget_delta,
        status: execution.status,
        created_at: execution.created_at,
      },
      experiment_id: id,
    }, { status: 201 });
  })
);
