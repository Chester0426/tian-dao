import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createVariantsSchema,
  variantsModeSchema,
  VARIANT_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments/[id]/variants — list variants
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
      .from("variants")
      .select(VARIANT_COLUMNS)
      .eq("experiment_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch variants");
    }

    return NextResponse.json({ variants: data ?? [] });
  })
);

// POST /api/experiments/[id]/variants — create variants
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const mode = variantsModeSchema.parse(
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
    const variants = createVariantsSchema.parse(body);

    // mode=replace: delete existing variants for current round first
    if (mode === "replace") {
      await supabase
        .from("variants")
        .delete()
        .eq("experiment_id", id)
        .eq("round_number", experiment.current_round);
    }

    const rows = variants.map((v) => ({
      experiment_id: id,
      round_number: experiment.current_round,
      ...v,
    }));

    const { data, error } = await supabase
      .from("variants")
      .insert(rows)
      .select(VARIANT_COLUMNS);

    if (error) {
      throw new ApiError("internal_error", "Failed to create variants");
    }

    return NextResponse.json({ variants: data ?? [] }, { status: 201 });
  })
);
