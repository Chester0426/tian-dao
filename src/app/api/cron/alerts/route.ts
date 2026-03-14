import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// b-27: GET /api/cron/alerts — detect alert conditions (15min cron)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Find running experiments to check for alerts
  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, user_id, name, status")
    .eq("status", "running");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }

  const alertsCreated: string[] = [];

  for (const experiment of experiments ?? []) {
    // Alert detection logic would check for:
    // - Budget exhaustion
    // - Stale metrics (no new data in 24h)
    // - Dropping dimensions (conversion rate declining)
    // This is a placeholder — full implementation in Session 3.
    void experiment;
  }

  return NextResponse.json({
    alerts_created: alertsCreated.length,
    timestamp: new Date().toISOString(),
  });
}
