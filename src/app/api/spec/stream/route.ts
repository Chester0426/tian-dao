import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { stream as aiStream } from "@/lib/ai";
import { parseSpecStreamLine } from "@/lib/spec-stream-parser";

const streamSchema = z.object({
  idea: z
    .string()
    .min(20, "Idea must be at least 20 characters")
    .max(10000, "Idea is too long"),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .default(1),
  session_token: z.string().uuid("Invalid session token"),
  regenerate_token: z
    .string()
    .uuid("Invalid regenerate token")
    .optional(),
});

const SYSTEM_PROMPT_TEMPLATE = `You are an experiment design expert running in inference mode. Given a startup idea, generate a complete testable experiment specification.

INFERENCE MODE RULES:
- NEVER ask follow-up questions. Infer all missing information aggressively.
- Mark inferred values with [inferred] so users can see what was assumed.
- Even with minimal input, generate a complete spec.
- If the input is genuinely too vague (single word with no context), emit a single >>>EVENT: {"type":"input_too_vague"} and stop.

OUTPUT FORMAT:
You MUST emit structured events as single-line JSON, each prefixed with ">>>EVENT: ".
Between events you may include reasoning text (ignored by the parser).

Emit events in this exact order:
1. meta — experiment name, level, type
2. cost — build cost, ad budget, estimated days
3. preflight — 4 dimensions (market, problem, competition, icp), each with pass/caution/fail
4. preflight_opinion — your overall assessment as conversational text
5. hypothesis — 2-7 testable hypotheses (based on level)
6. variant — 3-5 messaging variants with different angles
7. funnel — available funnel dimensions by level
8. complete — full spec data as JSON

EVENT SCHEMAS:
>>>EVENT: {"type":"meta","name":"<kebab-case-name>","level":<1|2|3>,"experiment_type":"<web-app|service|cli>"}
>>>EVENT: {"type":"cost","build_cost":<number>,"ad_budget":<number>,"estimated_days":<number>}
>>>EVENT: {"type":"preflight","dimension":"<market|problem|competition|icp>","status":"<pass|caution|fail>","summary":"<1-2 sentences>","confidence":"<high|medium|low>"}
>>>EVENT: {"type":"preflight_opinion","text":"<conversational AI opinion>"}
>>>EVENT: {"type":"hypothesis","id":"<h-NN>","category":"<reach|demand|activate|monetize|retain>","statement":"<testable statement>","metric":{"formula":"<metric formula>","threshold":<number>,"operator":"<gt|gte|lt|lte>"},"priority_score":<0-100>,"experiment_level":<1|2|3>,"depends_on":["<h-NN>"]}
>>>EVENT: {"type":"variant","slug":"<kebab-case>","headline":"<headline>","subheadline":"<subheadline>","cta":"<call to action>","pain_points":["<point1>","<point2>","<point3>"],"promise":"<promise>","proof":"<proof>","urgency":<"text"|null>}
>>>EVENT: {"type":"funnel","available_from":{"reach":"L1","demand":"L1","activate":"L2","monetize":"L2","retain":"L3"}}
>>>EVENT: {"type":"complete","spec":{<full experiment spec as JSON>},"anonymous_spec_id":"<placeholder>"}

SPEC REASONING RULES:

1. Market Sizing Reasoning
- Identify a specific, bounded group of potential users
- Confirm people currently pay money or significant time to solve this problem
- Verify at least 2 market signals (forum threads, competitor reviews, job postings, industry reports)
- Confirm target users are reachable via planned channels (100+ users in experiment window)
- Ensure the market is not shrinking

2. Competitive Differentiation Reasoning
- Name at least 2 existing alternatives (direct or indirect)
- Articulate one specific gap competitors have, validated by user complaints
- Differentiation must be user-facing, not just technical
- At least one non-price advantage must exist
- Explain timing advantage (why now)

3. Hypothesis Quality Reasoning
- Each hypothesis must have a numeric threshold grounded in benchmarks
- All required categories for the level must have at least one hypothesis
- No duplicate hypotheses testing the same risk
- Dependencies must be explicit via depends_on
- Each hypothesis must be falsifiable
- Hypotheses must be level-appropriate

4. Behavior Traceability
- Every pending hypothesis has at least 1 behavior
- Every behavior traces to a hypothesis
- Behaviors are observable (analytics event, DB state change, user action)
- No implementation leakage (describe WHAT, not HOW)

5. Variant Distinctiveness
- >30% word difference between variant headlines
- Different emotional angles per variant
- Pain points are specific, not generic
- CTAs are action-oriented (start with a verb)
- No variant is clearly superior

6. Stack Appropriateness
- Level 1: no database/auth; Level 2: adds database; Level 3: adds auth and payment if monetize hypotheses exist
- No over-engineering beyond what hypotheses require
- Distribution-compatible (analytics present if using paid ads)
- Testing-compatible (stack.testing present if quality: production)`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = streamSchema.parse(body);
    const { idea, level, session_token, regenerate_token } = parsed;

    // Optional auth check — anonymous users can generate specs
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminSupabase = createAdminSupabaseClient();

    // Regenerate handling — delete old row before rate limit check
    let isRegeneration = false;
    if (regenerate_token) {
      const { data: existingSpec } = await adminSupabase
        .from("anonymous_specs")
        .select("id")
        .eq("id", regenerate_token)
        .eq("session_token", session_token)
        .single();

      if (!existingSpec) {
        return new Response(
          JSON.stringify({
            error: "Not found",
            message:
              "No spec found with that regenerate_token for this session",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Delete old row — regeneration replaces it (net count unchanged)
      await adminSupabase
        .from("anonymous_specs")
        .delete()
        .eq("id", regenerate_token);
      isRegeneration = true;
    }

    // DB-based rate limiting (survives serverless cold starts)
    // Regeneration skips rate limit: old row deleted above, net count unchanged
    if (!isRegeneration) {
      const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

      if (user) {
        // Authenticated: 5 per 24h across anonymous_specs + experiments
        const [anonResult, expResult] = await Promise.all([
          adminSupabase
            .from("anonymous_specs")
            .select("id", { count: "exact", head: true })
            .eq("session_token", session_token)
            .gte("created_at", since24h),
          adminSupabase
            .from("experiments")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", since24h),
        ]);
        const totalCount = (anonResult.count ?? 0) + (expResult.count ?? 0);
        if (totalCount >= 5) {
          return new Response(
            JSON.stringify({
              error: {
                code: "rate_limited",
                message: "Too many requests. Please try again later.",
              },
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "3600",
              },
            }
          );
        }
      } else {
        // Anonymous: 3 per 24h per session_token
        const { count } = await adminSupabase
          .from("anonymous_specs")
          .select("id", { count: "exact", head: true })
          .eq("session_token", session_token)
          .gte("created_at", since24h);
        if ((count ?? 0) >= 3) {
          return new Response(
            JSON.stringify({
              error: {
                code: "rate_limited",
                message: "Too many requests. Please try again later.",
              },
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "3600",
              },
            }
          );
        }
      }
    }

    // Check for AI service availability
    if (!process.env.ANTHROPIC_API_KEY && process.env.DEMO_MODE !== "true") {
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build system prompt
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}

The user's idea is for a Level ${level} experiment.`;

    // Create SSE ReadableStream
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const response = await aiStream({
            max_tokens: 8192,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: `Generate an experiment spec for this idea:\n\n${idea}`,
              },
            ],
          });

          let buffer = "";
          let fullSpec: Record<string, unknown> | null = null;
          const preflightResults: Array<Record<string, unknown>> = [];

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              buffer += event.delta.text;

              // Process complete lines
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? ""; // keep incomplete line in buffer

              for (const line of lines) {
                const parsed = parseSpecStreamLine(line);
                if (parsed) {
                  if (parsed.type === "preflight") {
                    preflightResults.push(parsed);
                  }
                  if (parsed.type === "complete") {
                    // Capture spec but don't forward — we'll send a corrected
                    // complete event with the real anonymous_spec_id after upsert
                    fullSpec = parsed.spec;
                    continue;
                  }
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify(parsed)}\n\n`
                    )
                  );
                }
              }
            }
          }

          // Process remaining buffer
          const lastParsed = parseSpecStreamLine(buffer);
          if (lastParsed) {
            if (lastParsed.type === "preflight")
              preflightResults.push(lastParsed);
            if (lastParsed.type === "complete") {
              fullSpec = lastParsed.spec;
            } else {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(lastParsed)}\n\n`)
              );
            }
          }

          // Store spec in anonymous_specs (graceful degradation on failure)
          // Set expires_at explicitly to refresh TTL on upsert (DB default only applies to INSERT)
          try {
            const { data: upsertResult } = await adminSupabase
              .from("anonymous_specs")
              .upsert(
                {
                  session_token,
                  idea_text: idea,
                  spec_data: fullSpec ?? {},
                  preflight_results:
                    preflightResults.length > 0 ? preflightResults : null,
                  expires_at: new Date(
                    Date.now() + 24 * 60 * 60_000
                  ).toISOString(),
                },
                { onConflict: "session_token" }
              )
              .select("id")
              .single();

            // Send complete event with real anonymous_spec_id
            if (fullSpec && upsertResult) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "complete",
                    spec: fullSpec,
                    anonymous_spec_id: upsertResult.id,
                  })}\n\n`
                )
              );
            }
          } catch {
            // Supabase write failure — degrade gracefully
            // Client keeps spec from Claude's complete event (placeholder ID)
          }

          if (!fullSpec) {
            // No complete event from Claude — send error
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "Spec generation incomplete" })}\n\n`
              )
            );
          }

          controller.close();
        } catch (err) {
          console.error("[spec/stream] AI error:", err);
          const message = "AI analysis failed. Please try again.";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message })}\n\n`
            )
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
