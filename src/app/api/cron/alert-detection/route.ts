import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// GET /api/cron/alert-detection — 15-minute cron: detect alerts for running experiments
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // Find running experiments
  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, user_id, name")
    .eq("status", "running");

  if (error || !experiments) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  const alertsCreated: string[] = [];

  for (const exp of experiments) {
    // Check for budget exhaustion
    const { data: distributions } = await supabase
      .from("distributions")
      .select("id, channel, budget_cents, spent_cents")
      .eq("experiment_id", exp.id)
      .eq("status", "active");

    if (distributions) {
      for (const dist of distributions) {
        if (dist.spent_cents >= dist.budget_cents && dist.budget_cents > 0) {
          // Check if alert already exists (unresolved)
          const { data: existing } = await supabase
            .from("experiment_alerts")
            .select("id")
            .eq("experiment_id", exp.id)
            .eq("alert_type", "budget_exhaustion")
            .eq("resolved", false)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("experiment_alerts").insert({
              experiment_id: exp.id,
              alert_type: "budget_exhaustion",
              severity: "critical",
              message: `Budget exhausted for ${dist.channel} channel. Spent $${(dist.spent_cents / 100).toFixed(2)} of $${(dist.budget_cents / 100).toFixed(2)} budget.`,
            });
            alertsCreated.push(`${exp.id}:budget_exhaustion`);
          }
        }
      }
    }

    // Check for stale metrics (no sync in 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleMetrics } = await supabase
      .from("experiment_metrics")
      .select("id")
      .eq("experiment_id", exp.id)
      .lt("synced_at", oneHourAgo)
      .limit(1);

    if (staleMetrics && staleMetrics.length > 0) {
      const { data: existing } = await supabase
        .from("experiment_alerts")
        .select("id")
        .eq("experiment_id", exp.id)
        .eq("alert_type", "stale_metrics")
        .eq("resolved", false)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("experiment_alerts").insert({
          experiment_id: exp.id,
          alert_type: "stale_metrics",
          severity: "warning",
          message: "Metrics have not been synced in over 1 hour. Data may be stale.",
        });
        alertsCreated.push(`${exp.id}:stale_metrics`);
      }
    }

    // Check for dropping dimensions (compare latest two metric snapshots)
    const { data: snapshots } = await supabase
      .from("experiment_metric_snapshots")
      .select("reach_ratio, demand_ratio, activate_ratio, monetize_ratio, retain_ratio")
      .eq("experiment_id", exp.id)
      .order("created_at", { ascending: false })
      .limit(2);

    if (snapshots && snapshots.length >= 2) {
      const [current, previous] = snapshots as Record<string, unknown>[];
      const dimensions = ["reach", "demand", "activate", "monetize", "retain"] as const;

      for (const dim of dimensions) {
        const key = `${dim}_ratio`;
        const currVal = Number(current[key] ?? 0);
        const prevVal = Number(previous[key] ?? 0);

        if (prevVal > 0 && currVal < prevVal * 0.7) {
          const { data: existingDim } = await supabase
            .from("experiment_alerts")
            .select("id")
            .eq("experiment_id", exp.id)
            .eq("alert_type", "dimension_dropping")
            .is("resolved_at", null)
            .limit(1);

          if (!existingDim || (existingDim as unknown[]).length === 0) {
            await supabase.from("experiment_alerts").insert({
              experiment_id: exp.id,
              alert_type: "dimension_dropping",
              channel: dim,
              severity: "warning",
              message: `${dim} dimension dropped from ${prevVal.toFixed(2)} to ${currVal.toFixed(2)} (${Math.round((1 - currVal / prevVal) * 100)}% decline)`,
            });
            alertsCreated.push(`${exp.id}:dimension_dropping:${dim}`);
          }
          break;
        }
      }
    }
  }

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    experiments_checked: experiments.length,
    alerts_created: alertsCreated.length,
    alerts: alertsCreated,
  });
}
