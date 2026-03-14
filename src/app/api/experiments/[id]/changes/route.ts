import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const changeRequestSchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  budget_delta: z.number().optional(),
});

// POST /api/experiments/[id]/changes — submit a change request (b-09)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const change = changeRequestSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify experiment ownership
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    // Store the change request metadata
    const changeRecord = {
      type: change.type,
      description: change.description,
      budget_delta: change.budget_delta,
      requested_at: new Date().toISOString(),
      status: "queued",
    };

    // Update budget_spent if budget_delta is provided
    const updatePayload: Record<string, unknown> = {
      status: experiment.status === "completed" ? "completed" : experiment.status,
    };
    if (change.budget_delta) {
      updatePayload.budget_spent = (change.budget_delta ?? 0);
    }

    const { data, error } = await supabase
      .from("experiments")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to submit change" }, { status: 500 });
    }

    return NextResponse.json({
      change: changeRecord,
      experiment_id: data.id,
      experiment_status: data.status,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
