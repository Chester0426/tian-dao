import { z } from "zod";

// --- Experiments ---

export const createExperimentSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  idea_text: z
    .string()
    .min(1, "Idea text is required")
    .max(10000, "Idea text too long"),
  experiment_type: z
    .enum(["web-app", "service", "cli"])
    .optional()
    .default("web-app"),
});

export const updateExperimentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z
    .enum([
      "draft",
      "active",
      "paused",
      "verdict_ready",
      "completed",
      "archived",
    ])
    .optional(),
  deployed_url: z.string().max(500).optional(),
  decision: z.enum(["scale", "refine", "pivot", "kill"]).optional(),
  decision_reasoning: z.string().max(5000).optional(),
  budget: z.number().min(0).optional(),
});

export const listExperimentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "active", "paused", "verdict_ready", "completed", "archived"]).optional(),
});

// --- Hypotheses ---

export const createHypothesisSchema = z.object({
  hypothesis_key: z.string().min(1).max(50),
  category: z.enum(["demand", "reach", "activate", "monetize", "retain"]),
  statement: z.string().min(1).max(1000),
  metric_formula: z.string().max(200).optional(),
  metric_threshold: z.number().optional(),
  metric_operator: z.enum(["gt", "gte", "lt", "lte"]).optional(),
  priority_score: z.number().int().min(0).max(100).optional(),
});

export const createHypothesesSchema = z.array(createHypothesisSchema).min(1);

export const hypothesesModeSchema = z.enum(["append", "replace"]).default("append");

// --- Variants ---

export const createVariantSchema = z.object({
  slug: z.string().min(1).max(50),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(500).optional(),
  cta: z.string().min(1).max(100),
  pain_points: z.string().max(2000).optional(),
  promise: z.string().max(500).optional(),
  proof: z.string().max(500).optional(),
  urgency: z.string().max(500).optional(),
});

export const createVariantsSchema = z.array(createVariantSchema).min(1);

export const variantsModeSchema = z.enum(["append", "replace"]).default("append");

// --- Insights (experiment_decisions) ---

export const createInsightSchema = z.object({
  decision: z.enum(["scale", "refine", "pivot", "kill"]),
  reasoning: z.string().max(5000).optional(),
  next_steps: z.string().max(2000).optional(),
  round_number: z.number().int().min(1).optional(),
});

// --- Research ---

export const createResearchSchema = z.object({
  query: z.string().min(1).max(1000),
  summary: z.string().min(1).max(5000),
  sources: z.array(z.string().max(500)).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  verdict: z.enum(["confirmed", "rejected", "inconclusive"]),
  hypothesis_id: z.string().uuid().optional(),
});

// --- Rounds ---

export const createRoundSchema = z.object({
  spec_snapshot: z.record(z.string(), z.unknown()),
});

// --- Column lists (explicit, no SELECT *) ---

export const EXPERIMENT_LIST_COLUMNS =
  "id, name, experiment_type, idea_text, status, experiment_level, current_round, budget, budget_spent, decision, deployed_url, started_at, ended_at, archived_at, created_at, updated_at" as const;

export const EXPERIMENT_DETAIL_COLUMNS =
  "id, user_id, name, experiment_type, idea_text, status, experiment_level, current_round, stimulus_format, estimated_days, recommended_ad_budget, variable_being_tested, budget, budget_spent, decision, decision_reasoning, parent_experiment_id, deployed_url, repo_url, vercel_project_id, started_at, ended_at, archived_at, created_at, updated_at" as const;

export const HYPOTHESIS_COLUMNS =
  "id, hypothesis_key, category, statement, test_method, metric_formula, metric_threshold, metric_operator, priority_score, status, automation_type, experiment_level, round_number, resolved_at, created_at" as const;

export const VARIANT_COLUMNS =
  "id, slug, headline, subheadline, cta, pain_points, promise, proof, urgency, pricing_amount, pricing_model, round_number, created_at" as const;

export const INSIGHT_COLUMNS =
  "id, round_number, decision, reasoning, next_steps, bottleneck_dimension, bottleneck_recommendation, created_at" as const;

export const RESEARCH_COLUMNS =
  "id, hypothesis_id, query, summary, sources, confidence, verdict, created_at" as const;

export const ROUND_COLUMNS =
  "id, round_number, spec_snapshot, decision, bottleneck_dimension, bottleneck_ratio, ai_fix_suggestion, started_at, ended_at, created_at" as const;
