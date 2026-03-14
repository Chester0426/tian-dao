import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { withAuth } from "@/lib/api-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const createDistributionSchema = z.object({
  channel: z.enum(["twitter-organic", "reddit-organic", "email-resend", "google-ads", "meta-ads", "twitter-ads"]),
  campaign_name: z.string().min(1).max(200),
  budget_cents: z.number().int().min(0).max(100_000_00),
  utm_source: z.string().min(1).max(100),
  utm_medium: z.string().min(1).max(100),
  utm_campaign: z.string().min(1).max(200),
});

// GET /api/experiments/[id]/distribution — list campaigns
export const GET = withErrorHandler(
  await withAuth(async (_request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: experiment } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) throw new ApiError("not_found", "Experiment not found");

    const { data, error } = await supabase
      .from("distribution_campaigns")
      .select("id, channel, campaign_name, campaign_id, budget_cents, spend_cents, impressions, clicks, conversions, ctr, status, metrics_synced_at, created_at, updated_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError("internal_error", "Failed to fetch campaigns");

    return NextResponse.json({ campaigns: data });
  })
);

// POST /api/experiments/[id]/distribution — create campaign
export const POST = withErrorHandler(
  await withAuth(async (request, context, user) => {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: experiment } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single();

    if (!experiment) throw new ApiError("not_found", "Experiment not found");

    const body = await request.json();
    const { channel, campaign_name, budget_cents, utm_source, utm_medium, utm_campaign } = createDistributionSchema.parse(body);

    const { data, error } = await supabase
      .from("distribution_campaigns")
      .insert({
        experiment_id: id,
        channel,
        campaign_name,
        budget_cents,
        utm_source,
        utm_medium,
        utm_campaign,
        status: "draft",
      })
      .select("id, channel, campaign_name, budget_cents, status, created_at")
      .single();

    if (error) throw new ApiError("internal_error", "Failed to create campaign");

    return NextResponse.json({ campaign: data }, { status: 201 });
  })
);
