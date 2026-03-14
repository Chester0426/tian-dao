import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// b-29: GET /api/cron/notifications — dispatch notifications (daily cron)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Find experiments that have reached milestones, verdicts, or alert conditions
  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, user_id, name, status, verdict")
    .in("status", ["running", "completed"]);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  const notified: string[] = [];

  for (const experiment of experiments ?? []) {
    // Notification dispatch logic:
    // - Milestone notifications (experiment started, first visitor, etc.)
    // - Verdict notifications (experiment completed with verdict)
    // - Alert notifications (budget exhaustion, stale data)
    // This is a placeholder — full implementation in Session 3.
    void experiment;
  }

  return NextResponse.json({
    notifications_sent: notified.length,
    timestamp: new Date().toISOString(),
  });
}
