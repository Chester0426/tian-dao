import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";

const createExperimentSchema = z.object({
  spec_id: z.string().uuid("Invalid spec ID").optional(),
  name: z.string().min(1).max(200).optional(),
});

// b-18: GET /api/experiments — list user's experiments
export const GET = withAuth(async (_request, _context, user) => {
  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, name, status, verdict, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  // Add default metrics for each experiment (actual metrics from metrics table in full schema)
  const enriched = (experiments ?? []).map((exp: { id: string; name: string; status: string; verdict: string | null; created_at: string }) => ({
    ...exp,
    metrics: {
      visitors: 0,
      signups: 0,
      conversion_rate: null,
    },
  }));

  return NextResponse.json({ experiments: enriched });
});

// b-18: POST /api/experiments — create a new experiment
export const POST = withAuth(async (request, _context, user) => {
  const body = await request.json();
  const parsed = createExperimentSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // If spec_id provided, get spec name
  let name = parsed.name ?? "Untitled Experiment";
  if (parsed.spec_id) {
    const { data: spec } = await supabase
      .from("specs")
      .select("idea_text")
      .eq("id", parsed.spec_id)
      .single();
    if (spec) {
      name = spec.idea_text.slice(0, 100);
    }
  }

  const { data: experiment, error } = await supabase
    .from("experiments")
    .insert({
      user_id: user.id,
      name,
      status: "draft",
    })
    .select("id, name, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
  }

  return NextResponse.json(experiment, { status: 201 });
});
