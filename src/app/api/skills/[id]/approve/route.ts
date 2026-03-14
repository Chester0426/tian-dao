import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const approveSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

// POST /api/skills/[id]/approve — approve or reject a pending operation
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action } = approveSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify skill execution ownership and paused (gate) status
    const { data: op, error: opError } = await supabase
      .from("skill_executions")
      .select("id, status, gate_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "paused")
      .single();

    if (opError || !op) {
      return NextResponse.json(
        { error: "Skill execution not found or not awaiting approval" },
        { status: 404 }
      );
    }

    const newStatus = action === "approve" ? "pending" : "failed";
    const errorMessage = action === "reject" ? "Rejected by user" : null;

    const { data, error } = await supabase
      .from("skill_executions")
      .update({
        status: newStatus,
        error_message: errorMessage,
        ...(action === "approve" ? { started_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .select("id, skill_name, status, started_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update skill execution" }, { status: 500 });
    }

    return NextResponse.json({ execution: data });
  } catch (error) {
    return handleApiError(error);
  }
}
