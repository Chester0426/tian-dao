import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const createDistributionSchema = z.object({
  channel: z.enum(["twitter-organic", "reddit-organic", "email-resend", "google-ads", "meta-ads", "twitter-ads"]),
  campaign_name: z.string().min(1).max(200, "Campaign name too long"),
  budget_cents: z.number().int().min(0).max(100_000_00), // max $100,000
  utm_source: z.string().min(1).max(100),
  utm_medium: z.string().min(1).max(100),
  utm_campaign: z.string().min(1).max(200),
});

// GET /api/experiments/[id]/distribution — list distributions
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify experiment ownership
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("distribution_campaigns")
      .select("id, channel, campaign_name, campaign_id, budget_cents, spend_cents, impressions, clicks, conversions, ctr, status, metrics_synced_at, created_at, updated_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/experiments/[id]/distribution — create distribution
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { channel, campaign_name, budget_cents, utm_source, utm_medium, utm_campaign } = createDistributionSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify experiment ownership
    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

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

    if (error) {
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }

    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
