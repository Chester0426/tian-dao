import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "running", "paused", "completed", "archived"]).optional(),
});

// b-18: GET /api/experiments/[id] — get single experiment with scorecard data
export const GET = withAuth(async (_request, context, user) => {
  const { id } = await context.params;

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: experiment, error } = await supabase
    .from("experiments")
    .select("id, name, status, verdict, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Return enriched experiment data for scorecard (b-08)
  return NextResponse.json({
    ...experiment,
    hypotheses: [],
    funnel: [],
    alerts: [],
  });
});

// b-18: PATCH /api/experiments/[id] — update experiment
export const PATCH = withAuth(async (request, context, user) => {
  const { id } = await context.params;
  const body = await request.json();
  const updates = updateSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, status, updated_at")
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: "Experiment not found or update failed" }, { status: 404 });
  }

  return NextResponse.json(experiment);
});

// b-18: DELETE /api/experiments/[id] — delete experiment
export const DELETE = withAuth(async (_request, context, user) => {
  const { id } = await context.params;

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("experiments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete experiment" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
});
