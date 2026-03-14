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

    // Only claim specs that are currently anonymous (user_id IS NULL)
    const { data, error } = await supabase
      .from("specs")
      .update({ user_id: user.id })
      .eq("id", spec_id)
      .is("user_id", null)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Spec not found or already claimed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ claimed: true, spec_id: data.id });
  } catch (error) {
    return handleApiError(error);
  }
}
