import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/api-error";

const createDistributionSchema = z.object({
  channel: z.string().min(1).max(50, "Channel name too long"),
  budget_cents: z.number().int().min(0).max(100_000_00), // max $100,000
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
      .from("distributions")
      .select("id, channel, campaign_id, budget_cents, spent_cents, impressions, clicks, status, synced_at, created_at")
      .eq("experiment_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch distributions" }, { status: 500 });
    }

    return NextResponse.json({ distributions: data });
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
    const { channel, budget_cents } = createDistributionSchema.parse(body);

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
      .from("distributions")
      .insert({
        experiment_id: id,
        channel,
        budget_cents,
        status: "draft",
      })
      .select("id, channel, budget_cents, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create distribution" }, { status: 500 });
    }

    return NextResponse.json({ distribution: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
