import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";

// b-10: GET /api/experiments/[id]/verdict — get experiment verdict
export const GET = withAuth(async (_request, context, user) => {
  const { id } = await context.params;

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify experiment ownership
  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .select("id, name, verdict, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (expError || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  if (!experiment.verdict) {
    return NextResponse.json(
      { error: "Verdict not ready yet" },
      { status: 404 }
    );
  }

  // Return verdict data (b-10, b-11)
  return NextResponse.json({
    id: experiment.id,
    experiment_id: experiment.id,
    experiment_name: experiment.name,
    verdict: experiment.verdict,
    confidence: 0,
    rationale: "",
    hypotheses: [],
    distribution_roi: [],
    created_at: new Date().toISOString(),
  });
});
