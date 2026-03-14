import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// GET /api/cron/notifications — daily cron: dispatch notifications for milestones and verdicts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const notificationsSent: string[] = [];

  // Find experiments with decisions that haven't been notified (verdict_ready or completed)
  const { data: completedExperiments } = await supabase
    .from("experiments")
    .select("id, user_id, name, decision")
    .in("status", ["verdict_ready", "completed"])
    .not("decision", "is", null);

  if (completedExperiments) {
    for (const exp of completedExperiments) {
      // Check if verdict_ready notification already sent
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("experiment_id", exp.id)
        .eq("trigger_type", "verdict_ready")
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notifications").insert({
          user_id: exp.user_id,
          experiment_id: exp.id,
          trigger_type: "verdict_ready",
          channel: "email",
        });
        notificationsSent.push(`${exp.id}:verdict_ready`);
      }
    }
  }

  // Find unresolved critical alerts that need notifications
  const { data: criticalAlerts } = await supabase
    .from("experiment_alerts")
    .select("id, experiment_id, alert_type, message")
    .eq("severity", "critical")
    .is("resolved_at", null);

  if (criticalAlerts) {
    for (const alert of criticalAlerts) {
      // Look up experiment owner
      const { data: exp } = await supabase
        .from("experiments")
        .select("user_id, name")
        .eq("id", alert.experiment_id)
        .single();

      if (exp) {
        // Check if alert notification already sent (within last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("experiment_id", alert.experiment_id)
          .eq("trigger_type", "budget_alert")
          .gt("created_at", oneDayAgo)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("notifications").insert({
            user_id: exp.user_id,
            experiment_id: alert.experiment_id,
            trigger_type: "budget_alert",
            channel: "email",
          });
          notificationsSent.push(`${alert.experiment_id}:budget_alert`);
        }
      }
    }
  }

  return NextResponse.json({
    dispatched_at: new Date().toISOString(),
    notifications_sent: notificationsSent.length,
    notifications: notificationsSent,
  });
}
