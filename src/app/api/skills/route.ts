import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const createSkillSchema = z.object({
  experiment_id: z.string().uuid("Invalid experiment ID"),
  skill: z.string().min(1).max(50),
  input: z.record(z.string(), z.unknown()).optional().default({}),
});

// POST /api/skills — create a skill execution
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { experiment_id, skill, input } = createSkillSchema.parse(body);

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

    // Skills that require approval before execution
    const approvalRequired = ["deploy", "distribute"];
    const status = approvalRequired.includes(skill) ? "awaiting_approval" : "queued";

    const { data, error } = await supabase
      .from("operations")
      .insert({
        experiment_id,
        user_id: user.id,
        skill,
        status,
        input,
      })
      .select("id, skill, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create operation" }, { status: 500 });
    }

    return NextResponse.json({ operation: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/skills — list user's operations
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
      .from("operations")
      .select("id, experiment_id, skill, status, started_at, completed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch operations" }, { status: 500 });
    }

    return NextResponse.json({ operations: data });
  } catch (error) {
    return handleApiError(error);
  }
}
