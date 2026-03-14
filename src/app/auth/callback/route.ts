import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  if (process.env.DEMO_MODE === "true")
    return NextResponse.redirect(`${origin}/`);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/assay";

  // Validate redirect path: must start with "/" and must not start with "//"
  // to prevent open redirect to external domains (e.g., "//evil.com")
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/assay";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
