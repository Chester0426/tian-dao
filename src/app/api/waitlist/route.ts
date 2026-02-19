// TODO: Add production rate limiting (e.g., Upstash Redis)
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const WaitlistSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = WaitlistSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("waitlist_entries")
      .insert({ email: result.data.email });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This email is already on the waitlist" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
