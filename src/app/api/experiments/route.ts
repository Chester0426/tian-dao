import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const createExperimentSchema = z.object({
  spec_id: z.string().uuid("Invalid spec ID").optional(),
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().max(2000, "Description too long").optional(),
});

// GET /api/experiments — list user's experiments
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
      .from("experiments")
      .select("id, name, description, status, verdict, started_at, ended_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
    }

    return NextResponse.json({ experiments: data });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/experiments — create experiment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spec_id, name, description } = createExperimentSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("experiments")
      .insert({
        user_id: user.id,
        spec_id: spec_id ?? null,
        name,
        description: description ?? null,
        status: "draft",
      })
      .select("id, name, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
    }

    return NextResponse.json({ experiment: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
