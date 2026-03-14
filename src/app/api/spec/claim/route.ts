import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { handleApiError } from "@/lib/api-error";

const claimSchema = z.object({
  spec_id: z.string().uuid("Invalid spec ID"),
  session_token: z.string().uuid("Invalid session token"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spec_id, session_token } = claimSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to bypass RLS on anonymous_specs
    const adminSupabase = createAdminSupabaseClient();

    // Fetch the anonymous spec and verify session_token ownership
    const { data: anonSpec, error: fetchError } = await adminSupabase
      .from("anonymous_specs")
      .select("id, idea_text, spec_data, session_token")
      .eq("id", spec_id)
      .eq("session_token", session_token)
      .single();

    if (fetchError || !anonSpec) {
      return NextResponse.json(
        { error: "Spec not found or already claimed" },
        { status: 404 }
      );
    }

    // Create an experiment from the anonymous spec
    const specData = (anonSpec.spec_data as Record<string, unknown>) ?? {};
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .insert({
        user_id: user.id,
        name: (specData.title as string) ?? anonSpec.idea_text?.slice(0, 200) ?? "Untitled Experiment",
        idea_text: anonSpec.idea_text,
        status: "draft",
      })
      .select("id")
      .single();

    if (expError || !experiment) {
      return NextResponse.json(
        { error: "Failed to create experiment from spec" },
        { status: 500 }
      );
    }

    // Delete the anonymous spec after claiming (admin client bypasses RLS)
    await adminSupabase.from("anonymous_specs").delete().eq("id", spec_id);

    return NextResponse.json({ claimed: true, spec_id: anonSpec.id, experiment_id: experiment.id });
  } catch (error) {
    return handleApiError(error);
  }
}
