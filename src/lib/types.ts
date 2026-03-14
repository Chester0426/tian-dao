// TypeScript types matching all Assayer database table schemas.
// Keep in sync with supabase/migrations/001_initial.sql.

// --- specs ---
// Stores AI-generated experiment specs (may be anonymous or user-owned).
export interface Spec {
  id: string;
  user_id: string | null; // null = anonymous (unclaimed)
  idea_text: string;
  spec_json: Record<string, unknown>;
  created_at: string;
}

// --- experiments ---
// A launched experiment derived from a spec.
export interface Experiment {
  id: string;
  user_id: string;
  spec_id: string | null;
  name: string;
  description: string | null;
  status: "draft" | "running" | "paused" | "completed";
  verdict: "SCALE" | "REFINE" | "PIVOT" | "KILL" | null;
  verdict_rationale: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// --- experiment_hypotheses ---
// Individual hypotheses tracked within an experiment.
export interface ExperimentHypothesis {
  id: string;
  experiment_id: string;
  hypothesis_id: string; // e.g. "h-01" from experiment.yaml
  category: "reach" | "demand" | "activate" | "monetize" | "retain";
  statement: string;
  threshold: number;
  operator: "gte" | "lte" | "gt" | "lt" | "eq";
  formula: string;
  status: "pending" | "passing" | "failing";
  score: number | null; // computed ratio vs threshold
  created_at: string;
}

// --- experiment_variants ---
// A/B test variants for an experiment.
export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  cta: string | null;
  promise: string | null;
  proof: string | null;
  urgency: string | null;
  pain_points: string[];
  is_control: boolean;
  created_at: string;
}

// --- experiment_metrics ---
// Synced funnel metrics for an experiment (refreshed by 15-min cron).
export interface ExperimentMetric {
  id: string;
  experiment_id: string;
  metric_name: string; // e.g. "visit_landing", "signup_complete"
  funnel_stage: "reach" | "demand" | "activate" | "monetize" | "retain";
  value: number;
  synced_at: string;
  created_at: string;
}

// --- experiment_alerts ---
// Alerts triggered by budget exhaustion, stale metrics, or dropping dimensions.
export interface ExperimentAlert {
  id: string;
  experiment_id: string;
  alert_type: "budget_exhaustion" | "stale_metrics" | "dropping_dimension";
  severity: "info" | "warning" | "critical";
  message: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// --- distributions ---
// Ad distribution campaigns for an experiment.
export interface Distribution {
  id: string;
  experiment_id: string;
  channel: string; // e.g. "google", "meta", "reddit"
  campaign_id: string | null; // external platform campaign ID
  budget_cents: number;
  spent_cents: number;
  impressions: number;
  clicks: number;
  status: "draft" | "active" | "paused" | "completed";
  synced_at: string | null;
  created_at: string;
}

// --- operations ---
// Skill execution queue (deploy, distribute, iterate, etc.).
export interface Operation {
  id: string;
  experiment_id: string;
  user_id: string;
  skill: string; // e.g. "deploy", "distribute", "iterate"
  status: "queued" | "running" | "awaiting_approval" | "approved" | "rejected" | "completed" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// --- subscriptions ---
// Stripe subscription state per user.
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due" | "trialing" | "unpaid";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  credits_cents: number; // PAYG top-up balance
  created_at: string;
  updated_at: string;
}

// --- notifications ---
// Notifications dispatched to experiment owners by the daily cron.
export interface Notification {
  id: string;
  user_id: string;
  experiment_id: string | null;
  type: "milestone" | "verdict" | "alert" | "billing";
  title: string;
  body: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// --- Convenience union / helper types ---

export type ExperimentStatus = Experiment["status"];
export type ExperimentVerdict = NonNullable<Experiment["verdict"]>;
export type SubscriptionPlan = Subscription["plan"];
export type OperationStatus = Operation["status"];
export type AlertType = ExperimentAlert["alert_type"];
export type FunnelStage = ExperimentMetric["funnel_stage"];
