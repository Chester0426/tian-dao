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

  // Find experiments with verdicts that haven't been notified
  const { data: completedExperiments } = await supabase
    .from("experiments")
    .select("id, user_id, name, verdict")
    .eq("status", "completed")
    .not("verdict", "is", null);

  if (completedExperiments) {
    for (const exp of completedExperiments) {
      // Check if verdict notification already sent
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("experiment_id", exp.id)
        .eq("type", "verdict")
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notifications").insert({
          user_id: exp.user_id,
          experiment_id: exp.id,
          type: "verdict",
          title: `Verdict: ${exp.verdict}`,
          body: `Your experiment "${exp.name}" has reached a verdict: ${exp.verdict}. Review the full analysis on the verdict page.`,
        });
        notificationsSent.push(`${exp.id}:verdict`);
      }
    }
  }

  // Find unresolved critical alerts that need notifications
  const { data: criticalAlerts } = await supabase
    .from("experiment_alerts")
    .select("id, experiment_id, alert_type, message")
    .eq("severity", "critical")
    .eq("resolved", false);

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
          .eq("type", "alert")
          .gt("created_at", oneDayAgo)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("notifications").insert({
            user_id: exp.user_id,
            experiment_id: alert.experiment_id,
            type: "alert",
            title: `Alert: ${alert.alert_type.replace(/_/g, " ")}`,
            body: alert.message,
          });
          notificationsSent.push(`${alert.experiment_id}:alert`);
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
