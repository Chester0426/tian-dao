import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// GET /api/cron/spec-cleanup — hourly cron: delete unclaimed anonymous specs > 24h
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Delete anonymous specs older than 24 hours
  const { data, error } = await supabase
    .from("specs")
    .delete()
    .is("user_id", null)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Failed to cleanup specs" }, { status: 500 });
  }

  return NextResponse.json({
    cleaned_at: new Date().toISOString(),
    deleted_count: data?.length ?? 0,
  });
}
