import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-helpers";
import { trackServerEvent } from "@/lib/analytics-server";

const distributionSchema = z.object({
  channels: z.array(z.string().max(50)).min(1).max(10),
  budget_cents: z.number().int().positive().optional(),
});

// b-24: GET /api/experiments/[id]/distribution — list distribution campaigns
export const GET = withAuth(async (_request, context, user) => {
  const { id } = await context.params;

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify experiment ownership
  const { data: experiment } = await supabase
    .from("experiments")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const { data: campaigns, error } = await supabase
    .from("distribution_campaigns")
    .select("id, channel, status, budget_cents, created_at")
    .eq("experiment_id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }

  return NextResponse.json({ campaigns: campaigns ?? [] });
});

// b-24: POST /api/experiments/[id]/distribution — create distribution campaign
export const POST = withAuth(async (request, context, user) => {
  const { id } = await context.params;
  const body = await request.json();
  const { channels, budget_cents } = distributionSchema.parse(body);

  const { createServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = await createServerSupabaseClient();

  // Verify experiment ownership
  const { data: experiment } = await supabase
    .from("experiments")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Insert campaigns for each channel
  const campaignRows = channels.map((channel: string) => ({
    experiment_id: id,
    user_id: user.id,
    channel,
    status: "pending",
    budget_cents: budget_cents ?? 0,
  }));

  const { data: campaigns, error } = await supabase
    .from("distribution_campaigns")
    .insert(campaignRows)
    .select("id, channel, status, budget_cents, created_at");

  if (error) {
    return NextResponse.json({ error: "Failed to create campaigns" }, { status: 500 });
  }

  await trackServerEvent("distribution_launched", user.id, {
    experiment_id: id,
    channels: channels.join(","),
  });

  return NextResponse.json({ campaigns: campaigns ?? [] }, { status: 201 });
});
