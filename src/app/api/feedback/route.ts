// POST /api/feedback — Submit feedback
// GET /api/feedback — List all feedback (admin only)
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { z } from "zod";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";

const schema = z.object({
  category: z.enum(["bug", "suggestion", "other"]),
  title: z.string().min(2).max(100),
  content: z.string().min(5).max(2000),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("feedback").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    category: body.category,
    title: body.title,
    content: body.content,
  });

  if (error) {
    console.error("feedback insert error:", error.message);
    return NextResponse.json({ error: "Failed to submit", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.id !== ADMIN_USER_ID) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}
