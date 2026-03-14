import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { stream as aiStream } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const streamSchema = z.object({
  idea: z.string().min(1, "Idea is required").max(10000, "Idea is too long"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea } = streamSchema.parse(body);

    // Check auth (optional - anonymous users can generate specs)
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Rate limit: by user ID for authenticated, by IP for anonymous
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitKey = user ? `spec-stream:${user.id}` : `spec-stream:ip:${ip}`;
    const rateLimited = checkRateLimit(rateLimitKey, 5);
    if (rateLimited) return rateLimited;

    // Insert spec record
    const { data: spec, error: insertError } = await supabase
      .from("specs")
      .insert({
        user_id: user?.id ?? null,
        idea_text: idea,
        spec_json: {},
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to create spec record" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const specId = spec?.id;

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY && process.env.DEMO_MODE !== "true") {
      return new Response(
        JSON.stringify({
          error: "Service not configured",
          service: "Anthropic",
          setup: "Run /deploy to provision credentials",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create SSE response
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const response = await aiStream({
            max_tokens: 4096,
            system: `You are an experiment design expert. Given a startup idea, generate a testable experiment spec with:
1. Problem Statement - the core problem being solved
2. Target User - who this is for
3. Hypotheses - testable assumptions with metrics and thresholds
4. Experiment Design - how to test the idea with real users
5. Success Metrics - what to measure and benchmarks
6. Risk Assessment - what could go wrong

Format your response as structured sections. Be specific and actionable.`,
            messages: [
              {
                role: "user",
                content: `Generate an experiment spec for this startup idea:\n\n${idea}`,
              },
            ],
          });

          // Send spec_id immediately
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ spec_id: specId })}\n\n`)
          );

          let fullText = "";

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullText += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          // Parse sections from fullText
          const sectionPattern = /(?:^|\n)(?:#{1,3}\s*)?(\d+\.\s+.+?)(?:\n)/g;
          const sections: { title: string; content: string }[] = [];
          let match;
          const matches: { index: number; title: string }[] = [];

          while ((match = sectionPattern.exec(fullText)) !== null) {
            matches.push({ index: match.index, title: match[1].trim() });
          }

          for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index + matches[i].title.length + 1;
            const end = i < matches.length - 1 ? matches[i + 1].index : fullText.length;
            sections.push({
              title: matches[i].title.replace(/^\d+\.\s*/, ""),
              content: fullText.slice(start, end).trim(),
            });
          }

          // Update spec with generated content
          if (specId) {
            await supabase
              .from("specs")
              .update({ spec_json: { text: fullText, sections } })
              .eq("id", specId);
          }

          // Send sections
          if (sections.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ sections })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[spec/stream] Generation error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          details: error.issues.map((e) => e.message),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
