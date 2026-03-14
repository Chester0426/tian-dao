import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// b-26: GET /api/cron/metrics — sync metrics from PostHog and ad platforms (15min cron)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Find running experiments with active distribution
  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, user_id, name, status")
    .eq("status", "running");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  const synced: string[] = [];

  for (const experiment of experiments ?? []) {
    // Metrics sync logic would query PostHog and ad platforms
    // and update the experiment's metrics in the database.
    // This is a placeholder — full implementation in Session 3.
    synced.push(experiment.id);
  }

  return NextResponse.json({
    synced: synced.length,
    experiment_ids: synced,
    timestamp: new Date().toISOString(),
  });
}
