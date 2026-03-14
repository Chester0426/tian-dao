import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";

const skillSchema = z.object({
  experiment_id: z.string().uuid(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const VALID_SKILLS = ["deploy", "distribute", "iterate"] as const;

// b-20: POST /api/skills/[skill] — trigger skill execution
export const POST = withAuth(async (request, context, user) => {
  const { skill } = await context.params;

  if (!VALID_SKILLS.includes(skill as (typeof VALID_SKILLS)[number])) {
    return NextResponse.json(
      { error: `Invalid skill: ${skill}. Valid skills: ${VALID_SKILLS.join(", ")}` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { experiment_id, params } = skillSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify experiment ownership
  const { data: experiment } = await supabase
    .from("experiments")
    .select("id, status")
    .eq("id", experiment_id)
    .eq("user_id", user.id)
    .single();

  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  // b-22: Check billing authorization for deploy/distribute
  if (skill === "deploy" || skill === "distribute") {
    const { data: billing } = await supabase
      .from("user_billing")
      .select("plan")
      .eq("user_id", user.id)
      .single();

    const plan = billing?.plan ?? "free";
    if (plan === "free") {
      // Check experiment count for free tier limit
      const { count } = await supabase
        .from("experiments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "running");

      if ((count ?? 0) >= 3) {
        return NextResponse.json(
          { error: "Free tier limit reached. Upgrade to Pro for unlimited experiments." },
          { status: 403 }
        );
      }
    }
  }

  // b-21: Skills that require approval pause and return pending status
  const requiresApproval = skill === "deploy" || skill === "distribute";

  // Insert skill execution record
  const { data: execution, error: insertError } = await supabase
    .from("skill_executions")
    .insert({
      experiment_id,
      user_id: user.id,
      skill,
      params: params ?? {},
      status: requiresApproval ? "pending_approval" : "queued",
    })
    .select("id, skill, status, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to queue skill execution" }, { status: 500 });
  }

  return NextResponse.json(execution, { status: 201 });
});
