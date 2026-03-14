// TypeScript types for Assayer database schema.
// Matches supabase/migrations/001_initial.sql

export type Experiment = {
  id: string;
  user_id: string;
  name: string;
  status: "draft" | "deploying" | "running" | "paused" | "completed" | "archived";
  verdict: "scale" | "refine" | "pivot" | "kill" | null;
  created_at: string;
  updated_at: string;
};

export type Spec = {
  id: string;
  user_id: string | null;
  experiment_id: string | null;
  idea_text: string;
  generated_spec: string | null;
  claimed: boolean;
  created_at: string;
};

export type UserBilling = {
  id: string;
  user_id: string;
  plan: "free" | "pro";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string;
};

export type ChangeRequest = {
  id: string;
  experiment_id: string;
  user_id: string;
  change_type: "pivot_variant" | "adjust_budget" | "extend_timeline" | "pause" | "resume";
  details: string | null;
  status: "pending" | "approved" | "rejected" | "executed";
  created_at: string;
};

export type SkillExecution = {
  id: string;
  experiment_id: string;
  user_id: string;
  skill: string;
  params: Record<string, unknown>;
  status: "queued" | "pending_approval" | "approved" | "running" | "completed" | "failed";
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
};

export type DistributionCampaign = {
  id: string;
  experiment_id: string;
  user_id: string;
  channel: string;
  status: "pending" | "active" | "paused" | "completed" | "failed";
  budget_cents: number;
  created_at: string;
};
