import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";
import { trackServerEvent } from "@/lib/analytics-server";

const changeRequestSchema = z.object({
  change_type: z.enum([
    "pivot_variant",
    "adjust_budget",
    "extend_timeline",
    "pause",
    "resume",
  ]),
  details: z.string().max(1000).optional(),
});

// b-09: POST /api/experiments/[id]/changes — submit a change request
export const POST = withAuth(async (request, context, user) => {
  const { id } = await context.params;
  const body = await request.json();
  const { change_type, details } = changeRequestSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify experiment ownership
  const { data: experiment, error: fetchError } = await supabase
    .from("experiments")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Insert change request
  const { data: changeRequest, error: insertError } = await supabase
    .from("change_requests")
    .insert({
      experiment_id: id,
      user_id: user.id,
      change_type,
      details: details ?? null,
      status: "pending",
    })
    .select("id, change_type, status, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to create change request" }, { status: 500 });
  }

  await trackServerEvent("change_request_submitted", user.id, {
    experiment_id: id,
    change_type,
  });

  return NextResponse.json(changeRequest, { status: 201 });
});
