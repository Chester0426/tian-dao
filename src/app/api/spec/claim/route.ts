import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const claimSchema = z.object({
  spec_id: z.string().uuid("Invalid spec ID"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spec_id } = claimSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the anonymous spec to claim it as an experiment
    const { data: anonSpec, error: fetchError } = await supabase
      .from("anonymous_specs")
      .select("id, idea_text, spec_data")
      .eq("id", spec_id)
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

    // Delete the anonymous spec after claiming
    await supabase.from("anonymous_specs").delete().eq("id", spec_id);

    return NextResponse.json({ claimed: true, spec_id: anonSpec.id, experiment_id: experiment.id });
  } catch (error) {
    return handleApiError(error);
  }
}
