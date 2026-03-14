import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createResearchSchema,
  RESEARCH_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments/[id]/research — list research results
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
      .from("research_results")
      .select(RESEARCH_COLUMNS)
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch research");
    }

    return NextResponse.json({ research: data ?? [] });
  })
);

// POST /api/experiments/[id]/research — store research result
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
    const research = createResearchSchema.parse(body);

    const row = {
      experiment_id: id,
      ...research,
    };

    const { data, error } = await supabase
      .from("research_results")
      .insert(row)
      .select(RESEARCH_COLUMNS)
      .single();

    if (error) {
      throw new ApiError("internal_error", "Failed to create research result");
    }

    return NextResponse.json({ research: data }, { status: 201 });
  })
);
