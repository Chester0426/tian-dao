import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";

const claimSchema = z.object({
  spec_id: z.string().uuid("Invalid spec ID"),
});

// b-17: POST /api/spec/claim — claim an anonymous spec to authenticated user
export const POST = withAuth(async (request, _context, user) => {
  const body = await request.json();
  const { spec_id } = claimSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify spec exists and is unclaimed
  const { data: spec, error: fetchError } = await supabase
    .from("specs")
    .select("id, user_id, claimed, created_at")
    .eq("id", spec_id)
    .single();

  if (fetchError || !spec) {
    return NextResponse.json({ error: "Spec not found" }, { status: 404 });
  }

  if (spec.claimed && spec.user_id) {
    return NextResponse.json({ error: "Spec already claimed" }, { status: 409 });
  }

  // Mitigate IDOR: only allow claiming specs created within the last hour.
  // This limits the window for UUID guessing attacks.
  // Known limitation: a session-token binding would be stronger but is not yet implemented.
  const specAge = Date.now() - new Date(spec.created_at).getTime();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  if (specAge > ONE_HOUR_MS) {
    return NextResponse.json({ error: "Spec has expired and cannot be claimed" }, { status: 410 });
  }

  // Claim the spec
  const { error: updateError } = await supabase
    .from("specs")
    .update({ user_id: user.id, claimed: true })
    .eq("id", spec_id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to claim spec" }, { status: 500 });
  }

  return NextResponse.json({ claimed: true, spec_id });
});
