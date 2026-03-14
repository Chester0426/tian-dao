import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createExperimentSchema,
  listExperimentsSchema,
  EXPERIMENT_LIST_COLUMNS,
} from "@/lib/experiment-schemas";

// GET /api/experiments — list user's experiments, paginated
export const GET = withErrorHandler(
  await withAuth(async (request, _context, user) => {
    const url = new URL(request.url);
    const { page, limit, status } = listExperimentsSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    const supabase = await createServerSupabaseClient();
    const offset = (page - 1) * limit;

    let query = supabase
      .from("experiments")
      .select(EXPERIMENT_LIST_COLUMNS, { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "archived") {
      query = query.not("archived_at", "is", null);
    } else {
      query = query.is("archived_at", null);
      if (status) {
        query = query.eq("status", status);
      }
    }

    const { data, count, error } = await query;

    if (error) {
      throw new ApiError("internal_error", "Failed to fetch experiments");
    }

    return NextResponse.json({
      experiments: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  })
);

// POST /api/experiments — create experiment
export const POST = withErrorHandler(
  await withAuth(async (request, _context, user) => {
    const body = await request.json();
    const { name, idea_text, experiment_type } =
      createExperimentSchema.parse(body);

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("experiments")
      .insert({
        user_id: user.id,
        name,
        idea_text,
        experiment_type,
        status: "draft",
      })
      .select(EXPERIMENT_LIST_COLUMNS)
      .single();

    if (error) {
      throw new ApiError("internal_error", "Failed to create experiment");
    }

    return NextResponse.json({ experiment: data }, { status: 201 });
  })
);
