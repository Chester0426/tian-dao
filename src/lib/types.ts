// TypeScript types matching Assayer database schemas.
// Keep in sync with supabase/migrations/002_session3_complete_schema.sql.

export interface AnonymousSpec {
  id: string;
  session_token: string;
  spec_data: Record<string, unknown>;
  preflight_results: Record<string, unknown> | null;
  idea_text: string;
  created_at: string;
  expires_at: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  name: string;
  experiment_type: "web-app" | "service" | "cli";
  idea_text: string;
  status: ExperimentStatus;
  experiment_level: 1 | 2 | 3 | null;
  current_round: number;
  stimulus_format: string | null;
  estimated_days: number;
  recommended_ad_budget: number;
  variable_being_tested: string | null;
  budget: number;
  budget_spent: number;
  started_at: string | null;
  ended_at: string | null;
  decision: ExperimentDecisionValue | null;
  decision_reasoning: string | null;
  parent_experiment_id: string | null;
  deployed_url: string | null;
  repo_url: string | null;
  vercel_project_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExperimentStatus = "draft" | "active" | "paused" | "verdict_ready" | "completed" | "archived";
export type ExperimentDecisionValue = "scale" | "refine" | "pivot" | "kill";

export interface ExperimentRound {
  id: string;
  experiment_id: string;
  round_number: number;
  parent_round_id: string | null;
  spec_snapshot: Record<string, unknown>;
  decision: ExperimentDecisionValue | null;
  bottleneck_dimension: string | null;
  bottleneck_ratio: number | null;
  ai_fix_suggestion: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Hypothesis {
  id: string;
  experiment_id: string;
  round_number: number;
  hypothesis_key: string;
  category: FunnelStage;
  statement: string;
  test_method: string | null;
  metric_formula: string | null;
  metric_threshold: number | null;
  metric_operator: "gt" | "gte" | "lt" | "lte" | null;
  estimated_cost: number;
  priority_score: number;
  result: string | null;
  experiment_level: 1 | 2 | 3 | null;
  automation_type: "research" | "experiment" | "manual";
  status: HypothesisStatus;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type HypothesisStatus = "pending" | "testing" | "passed" | "failed" | "skipped" | "blocked";
export type FunnelStage = "demand" | "reach" | "activate" | "monetize" | "retain";

export interface HypothesisDependency {
  hypothesis_id: string;
  depends_on_id: string;
}

export interface ResearchResult {
  id: string;
  experiment_id: string;
  hypothesis_id: string | null;
  query: string;
  summary: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
  verdict: "confirmed" | "rejected" | "inconclusive";
  created_at: string;
}

export interface Variant {
  id: string;
  experiment_id: string;
  round_number: number;
  slug: string;
  headline: string;
  subheadline: string | null;
  cta: string;
  pain_points: string | null;
  promise: string | null;
  proof: string | null;
  urgency: string | null;
  pricing_amount: number | null;
  pricing_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentMetricSnapshot {
  id: string;
  experiment_id: string;
  round_number: number;
  reach_ratio: number | null;
  reach_actual: string | null;
  reach_threshold: string | null;
  reach_sample_size: number | null;
  reach_confidence: string | null;
  demand_ratio: number | null;
  demand_actual: string | null;
  demand_threshold: string | null;
  demand_sample_size: number | null;
  demand_confidence: string | null;
  activate_ratio: number | null;
  activate_actual: string | null;
  activate_threshold: string | null;
  activate_sample_size: number | null;
  activate_confidence: string | null;
  monetize_ratio: number | null;
  monetize_actual: string | null;
  monetize_threshold: string | null;
  monetize_sample_size: number | null;
  monetize_confidence: string | null;
  retain_ratio: number | null;
  retain_actual: string | null;
  retain_threshold: string | null;
  retain_sample_size: number | null;
  retain_confidence: string | null;
  channel_metrics: Record<string, unknown>;
  total_clicks: number;
  total_spend_cents: number;
  avg_cpc_cents: number;
  posthog_synced_at: string | null;
  distribution_synced_at: string | null;
  created_at: string;
}

export interface ExperimentDecision {
  id: string;
  experiment_id: string;
  round_number: number;
  decision: ExperimentDecisionValue;
  reach_ratio: number | null;
  reach_confidence: string | null;
  reach_sample_size: number | null;
  demand_ratio: number | null;
  demand_confidence: string | null;
  demand_sample_size: number | null;
  activate_ratio: number | null;
  activate_confidence: string | null;
  activate_sample_size: number | null;
  monetize_ratio: number | null;
  monetize_confidence: string | null;
  monetize_sample_size: number | null;
  retain_ratio: number | null;
  retain_confidence: string | null;
  retain_sample_size: number | null;
  bottleneck_dimension: string | null;
  bottleneck_recommendation: string | null;
  distribution_roi: Record<string, unknown> | null;
  reasoning: string | null;
  next_steps: string | null;
  created_at: string;
}

export interface ExperimentAlert {
  id: string;
  experiment_id: string;
  alert_type: AlertType;
  channel: string | null;
  message: string;
  severity: "info" | "warning" | "critical";
  resolved_at: string | null;
  created_at: string;
}

export type AlertType = "deploy_failed" | "ad_account_suspended" | "post_removed" | "budget_exhausted" | "metrics_stale" | "dimension_dropping" | "bug_auto_fixed";

export interface Notification {
  id: string;
  user_id: string;
  experiment_id: string | null;
  trigger_type: NotificationTriggerType;
  channel: "email" | "browser_push";
  scorecard_snapshot: Record<string, unknown> | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export type NotificationTriggerType = "experiment_live" | "first_traffic" | "mid_experiment" | "verdict_ready" | "budget_alert" | "dimension_dropping" | "bug_auto_fixed";

export interface AiUsage {
  id: string;
  user_id: string;
  experiment_id: string | null;
  skill_name: string;
  category: "analysis" | "implementation";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  operation_id: string | null;
  created_at: string;
}

export interface UserBilling {
  user_id: string;
  plan: BillingPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  creates_used: number;
  modifications_used: number;
  hosting_used: number;
  pool_resets_at: string | null;
  payg_balance_cents: number;
  created_at: string;
  updated_at: string;
}

export type BillingPlan = "payg" | "pro" | "team";
export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export interface SkillExecution {
  id: string;
  experiment_id: string | null;
  user_id: string;
  skill_name: string;
  status: SkillExecutionStatus;
  input_params: Record<string, unknown>;
  cloud_run_execution_id: string | null;
  gate_type: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type SkillExecutionStatus = "pending" | "running" | "paused" | "completed" | "failed" | "timed_out";

export interface OperationLedger {
  id: string;
  user_id: string;
  experiment_id: string | null;
  skill_execution_id: string | null;
  operation_type: OperationType;
  price_cents: number;
  billing_source: "pool" | "payg" | "free";
  status: OperationLedgerStatus;
  token_budget: number | null;
  actual_tokens_used: number | null;
  actual_cost_usd: number | null;
  classifier_output: Record<string, unknown> | null;
  parent_operation_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export type OperationType = "create_l1" | "create_l2" | "create_l3" | "change" | "small_fix" | "hosting" | "spec_gen";
export type OperationLedgerStatus = "authorized" | "completed" | "failed" | "refunded";

export interface OAuthToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionCampaign {
  id: string;
  experiment_id: string;
  round_number: number;
  channel: DistributionChannel;
  campaign_name: string;
  campaign_id: string | null;
  campaign_url: string | null;
  status: CampaignStatus;
  creative: Record<string, unknown>;
  targeting: Record<string, unknown>;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  budget_cents: number;
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc_cents: number | null;
  metrics_synced_at: string | null;
  ads_yaml: Record<string, unknown> | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DistributionChannel = "twitter-organic" | "reddit-organic" | "email-resend" | "google-ads" | "meta-ads" | "twitter-ads";
export type CampaignStatus = "draft" | "paused" | "active" | "completed" | "failed";
