import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";

const claimSchema = z.object({
  session_token: z.string().uuid("Invalid session token"),
});

const specDataSchema = z.object({
  name: z.string().max(200).optional(),
  experiment_type: z
    .enum(["web-app", "service", "cli"])
    .optional()
    .default("web-app"),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .default(1),
});

export const POST = withErrorHandler(
  await withAuth(async (request, _context, user) => {
    const body = await request.json();
    const { session_token } = claimSchema.parse(body);

    // Use admin client to bypass RLS on anonymous_specs
    const adminSupabase = createAdminSupabaseClient();

    // Fetch the anonymous spec by session_token
    const { data: anonSpec, error: fetchError } = await adminSupabase
      .from("anonymous_specs")
      .select("id, idea_text, spec_data, preflight_results, session_token")
      .eq("session_token", session_token)
      .single();

    if (fetchError || !anonSpec) {
      throw new ApiError("not_found", "Spec not found or already claimed");
    }

    // Extract and validate fields from spec_data
    const rawSpecData = (anonSpec.spec_data as Record<string, unknown>) ?? {};
    const validatedSpec = specDataSchema.parse(rawSpecData);
    const name =
      validatedSpec.name ||
      (anonSpec.idea_text as string)?.slice(0, 200) ||
      "Untitled Experiment";
    const experiment_type = validatedSpec.experiment_type;
    const experiment_level = validatedSpec.level;

    // Insert experiment using user's supabase client (RLS applies)
    const supabase = await createServerSupabaseClient();
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .insert({
        user_id: user.id,
        name,
        experiment_type,
        idea_text: anonSpec.idea_text,
        status: "draft",
        experiment_level,
      })
      .select("id")
      .single();

    if (expError || !experiment) {
      throw new ApiError("internal_error", "Failed to create experiment");
    }

    // Insert hypotheses if present
    const hypotheses = rawSpecData.hypotheses as Array<Record<string, unknown>> | undefined;
    if (hypotheses && hypotheses.length > 0) {
      const hypothesisRows = hypotheses.map((h) => ({
        experiment_id: experiment.id,
        hypothesis_id: h.id as string,
        category: h.category as string,
        statement: h.statement as string,
        metric: h.metric as string | null,
        priority_score: h.priority_score as number | null,
        experiment_level: h.experiment_level as number | null,
        depends_on: h.depends_on as string | null,
        status: "pending",
      }));

      await supabase
        .from("experiment_hypotheses")
        .insert(hypothesisRows);
    }

    // Insert variants if present
    const variants = rawSpecData.variants as Array<Record<string, unknown>> | undefined;
    if (variants && variants.length > 0) {
      const variantRows = variants.map((v) => ({
        experiment_id: experiment.id,
        slug: v.slug as string,
        headline: v.headline as string,
        subheadline: v.subheadline as string,
        cta: v.cta as string,
        pain_points: v.pain_points as string[],
        promise: v.promise as string,
        proof: v.proof as string,
        urgency: v.urgency as string,
      }));

      await supabase
        .from("experiment_variants")
        .insert(variantRows);
    }

    // Delete the anonymous spec after claiming (admin client bypasses RLS)
    await adminSupabase
      .from("anonymous_specs")
      .delete()
      .eq("id", anonSpec.id);

    return NextResponse.json({ experiment_id: experiment.id });
  })
);
