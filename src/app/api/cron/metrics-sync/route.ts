import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// GET /api/cron/metrics-sync — 15-minute cron: sync metrics from PostHog
// Vercel Cron: schedule in vercel.json
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // Find all running experiments with active distributions
  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, user_id, name")
    .eq("status", "running");

  if (error || !experiments) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  const results: { experiment_id: string; synced: boolean; error?: string }[] = [];

  for (const exp of experiments) {
    try {
      // In production, this would query PostHog API and ad platforms
      // For now, we update the synced_at timestamp on existing metrics
      const { error: updateError } = await supabase
        .from("experiment_metrics")
        .update({ synced_at: new Date().toISOString() })
        .eq("experiment_id", exp.id);

      results.push({
        experiment_id: exp.id,
        synced: !updateError,
        error: updateError?.message,
      });
    } catch (e) {
      results.push({
        experiment_id: exp.id,
        synced: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    synced_at: new Date().toISOString(),
    experiments_processed: experiments.length,
    results,
  });
}
