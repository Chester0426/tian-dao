import { z } from "zod";
import { stream } from "@/lib/ai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { trackServerEvent } from "@/lib/analytics-server";

const streamSchema = z.object({
  idea: z.string().min(1, "Idea text is required").max(10000, "Idea text too long"),
});

// b-16: POST /api/spec/stream — SSE stream of AI-generated spec
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea } = streamSchema.parse(body);

    // Check if user is authenticated (optional — anonymous allowed per b-03)
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const startTime = Date.now();
          const messageStream = await stream({
            max_tokens: 4096,
            system: `You are an experiment specification generator for startup idea validation.
Given a startup idea, generate a structured experiment spec with:
- Name and description
- Target user
- Hypotheses (reach, demand, activate, monetize, retain)
- Behaviors (given/when/then)
- Variants (A/B messaging)
- Funnel metrics
- Stack recommendations

Format the output as a clear, readable spec document.`,
            messages: [{ role: "user", content: idea }],
          });

          let fullText = "";
          for await (const event of messageStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text;
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Save spec to database if user is authenticated (b-05)
          if (user) {
            await supabase.from("specs").insert({
              user_id: user.id,
              idea_text: idea,
              generated_spec: fullText,
              claimed: true,
            });
          } else {
            // Save anonymous spec (b-03) — can be claimed later via /api/spec/claim
            const { data: specData } = await supabase.from("specs").insert({
              idea_text: idea,
              generated_spec: fullText,
              claimed: false,
            }).select("id").single();

            if (specData) {
              const idData = JSON.stringify({ spec_id: specData.id });
              controller.enqueue(encoder.encode(`data: ${idData}\n\n`));
            }
          }

          const generationTimeMs = Date.now() - startTime;
          await trackServerEvent("spec_generated", user?.id ?? "anonymous", {
            anonymous: !user,
            idea_length: idea.length,
            generation_time_ms: generationTimeMs,
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const errorData = JSON.stringify({
            error: err instanceof Error ? err.message : "Generation failed",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
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
      return Response.json({ error: "Invalid request", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Failed to start spec generation" }, { status: 500 });
  }
}
