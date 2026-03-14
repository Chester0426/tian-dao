import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";

// GET /api/spec/[id] — retrieve a spec by ID (used by launch page)
export const GET = withAuth(async (_request, context, user) => {
  const { id } = await context.params;

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  const { data: spec, error } = await supabase
    .from("specs")
    .select("id, idea_text, generated_spec, created_at, user_id, claimed")
    .eq("id", id)
    .single();

  if (error || !spec) {
    return NextResponse.json({ error: "Spec not found" }, { status: 404 });
  }

  // Only allow owner to view their spec
  if (spec.user_id && spec.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: spec.id,
    name: `Experiment from idea`,
    description: spec.idea_text,
    stack: { runtime: "nextjs", hosting: "vercel", database: "supabase" },
    behaviors: [],
    variants: [],
    hypotheses: [],
    generated_spec: spec.generated_spec,
    created_at: spec.created_at,
  });
});
