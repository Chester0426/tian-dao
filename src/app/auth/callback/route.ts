import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const CallbackSchema = z.object({
  code: z.string().min(1).optional(),
  next: z.string().startsWith("/").refine((v) => !v.startsWith("//"), {
    message: "Open redirect not allowed",
  }).optional().default("/dashboard"),
});

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  if (process.env.DEMO_MODE === "true") return NextResponse.redirect(`${origin}/`);

  const parsed = CallbackSchema.safeParse({
    code: searchParams.get("code") ?? undefined,
    next: searchParams.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/login?error=invalid_params`);
  }

  const { code, next } = parsed.data;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
