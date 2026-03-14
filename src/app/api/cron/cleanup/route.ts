import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// b-28: GET /api/cron/cleanup — delete unclaimed anonymous specs older than 24h (1h cron)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Delete unclaimed specs older than 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: deleted, error } = await supabase
    .from("specs")
    .delete()
    .eq("claimed", false)
    .is("user_id", null)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Failed to clean up specs" }, { status: 500 });
  }

  return NextResponse.json({
    deleted: (deleted ?? []).length,
    cutoff,
    timestamp: new Date().toISOString(),
  });
}
