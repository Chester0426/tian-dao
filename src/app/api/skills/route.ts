import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const createSkillSchema = z.object({
  experiment_id: z.string().uuid("Invalid experiment ID"),
  skill_name: z.string().min(1).max(50),
  input_params: z.record(z.string(), z.unknown()).optional().default({}),
});

// POST /api/skills — create a skill execution
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { experiment_id, skill_name, input_params } = createSkillSchema.parse(body);

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
      .select("id")
      .eq("id", experiment_id)
      .eq("user_id", user.id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    // Skills that require approval before execution — use gate_type
    const approvalRequired = ["deploy", "distribute"];
    const gate_type = approvalRequired.includes(skill_name) ? "approval" : null;
    const status = gate_type === "approval" ? "paused" : "pending";

    const { data, error } = await supabase
      .from("skill_executions")
      .insert({
        experiment_id,
        user_id: user.id,
        skill_name,
        status,
        input_params,
        gate_type,
      })
      .select("id, skill_name, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create skill execution" }, { status: 500 });
    }

    return NextResponse.json({ execution: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/skills — list user's skill executions
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("skill_executions")
      .select("id, experiment_id, skill_name, status, gate_type, started_at, completed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch skill executions" }, { status: 500 });
    }

    return NextResponse.json({ executions: data });
  } catch (error) {
    return handleApiError(error);
  }
}
