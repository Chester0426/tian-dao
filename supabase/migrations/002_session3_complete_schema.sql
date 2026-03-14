-- Session 3: Complete schema replacing bootstrap stubs
-- Matches product-design.md Section 6 exactly.
-- No production data exists — safe to DROP and recreate.

-- ============================================================
-- DROP old bootstrap tables (reverse FK order)
-- ============================================================
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS distributions CASCADE;
DROP TABLE IF EXISTS operations CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS experiment_alerts CASCADE;
DROP TABLE IF EXISTS experiment_metrics CASCADE;
DROP TABLE IF EXISTS experiment_variants CASCADE;
DROP TABLE IF EXISTS experiment_hypotheses CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS specs CASCADE;

-- ============================================================
-- 1. anonymous_specs (temporary, TTL 24h)
-- ============================================================
CREATE TABLE IF NOT EXISTS anonymous_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL UNIQUE,
  spec_data jsonb NOT NULL,
  preflight_results jsonb,
  idea_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_anonymous_specs_session ON anonymous_specs(session_token);
CREATE INDEX IF NOT EXISTS idx_anonymous_specs_expires ON anonymous_specs(expires_at);

-- RLS enabled: no policies for anon role (blocks all direct anon key access).
-- App routes use admin client (service role, bypasses RLS) with session_token filtering.
-- Cron cleanup uses admin client.
ALTER TABLE anonymous_specs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. experiments
-- ============================================================
CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  experiment_type text NOT NULL DEFAULT 'web-app'
    CHECK (experiment_type IN ('web-app', 'service', 'cli')),
  idea_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'verdict_ready', 'completed', 'archived')),
  experiment_level integer CHECK (experiment_level IN (1, 2, 3)),
  current_round integer NOT NULL DEFAULT 1,
  stimulus_format text,
  estimated_days integer DEFAULT 0,
  recommended_ad_budget numeric DEFAULT 0,
  variable_being_tested text,
  budget numeric DEFAULT 0,
  budget_spent numeric DEFAULT 0,
  started_at timestamptz,
  ended_at timestamptz,
  decision text CHECK (decision IN ('scale', 'refine', 'pivot', 'kill')),
  decision_reasoning text,
  parent_experiment_id uuid REFERENCES experiments(id),
  deployed_url text,
  repo_url text,
  vercel_project_id text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status) WHERE archived_at IS NULL;

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS experiments_user_isolation ON experiments;
CREATE POLICY experiments_user_isolation ON experiments
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 3. experiment_rounds (multi-round REFINE support)
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  parent_round_id uuid REFERENCES experiment_rounds(id),
  spec_snapshot jsonb NOT NULL,
  decision text CHECK (decision IN ('scale', 'refine', 'pivot', 'kill')),
  bottleneck_dimension text,
  bottleneck_ratio numeric,
  ai_fix_suggestion text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_experiment_rounds_experiment_id ON experiment_rounds(experiment_id);

ALTER TABLE experiment_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS experiment_rounds_user_isolation ON experiment_rounds;
CREATE POLICY experiment_rounds_user_isolation ON experiment_rounds
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 4. hypotheses
-- ============================================================
CREATE TABLE IF NOT EXISTS hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  hypothesis_key text NOT NULL,
  category text NOT NULL
    CHECK (category IN ('demand', 'reach', 'activate', 'monetize', 'retain')),
  statement text NOT NULL,
  test_method text,
  metric_formula text,
  metric_threshold numeric,
  metric_operator text CHECK (metric_operator IN ('gt', 'gte', 'lt', 'lte')),
  estimated_cost numeric DEFAULT 0,
  priority_score integer DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
  result text,
  experiment_level integer CHECK (experiment_level IN (1, 2, 3)),
  automation_type text NOT NULL DEFAULT 'experiment'
    CHECK (automation_type IN ('research', 'experiment', 'manual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'testing', 'passed', 'failed', 'skipped', 'blocked')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, round_number, hypothesis_key)
);

CREATE INDEX IF NOT EXISTS idx_hypotheses_experiment_id ON hypotheses(experiment_id);

ALTER TABLE hypotheses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hypotheses_user_isolation ON hypotheses;
CREATE POLICY hypotheses_user_isolation ON hypotheses
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 5. hypothesis_dependencies
-- ============================================================
CREATE TABLE IF NOT EXISTS hypothesis_dependencies (
  hypothesis_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  depends_on_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  PRIMARY KEY (hypothesis_id, depends_on_id),
  CHECK (hypothesis_id != depends_on_id)
);

ALTER TABLE hypothesis_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hypothesis_dependencies_user_isolation ON hypothesis_dependencies;
CREATE POLICY hypothesis_dependencies_user_isolation ON hypothesis_dependencies
  FOR ALL USING (
    hypothesis_id IN (
      SELECT h.id FROM hypotheses h
      WHERE h.experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
    )
  );

-- ============================================================
-- 6. research_results
-- ============================================================
CREATE TABLE IF NOT EXISTS research_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  hypothesis_id uuid REFERENCES hypotheses(id) ON DELETE SET NULL,
  query text NOT NULL,
  summary text NOT NULL,
  sources text[] DEFAULT '{}',
  confidence text NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  verdict text NOT NULL
    CHECK (verdict IN ('confirmed', 'rejected', 'inconclusive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_results_experiment_id ON research_results(experiment_id);

ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_results_user_isolation ON research_results;
CREATE POLICY research_results_user_isolation ON research_results
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 7. variants
-- ============================================================
CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  slug text NOT NULL,
  headline text NOT NULL,
  subheadline text,
  cta text NOT NULL,
  pain_points text,
  promise text,
  proof text,
  urgency text,
  pricing_amount numeric,
  pricing_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, round_number, slug)
);

CREATE INDEX IF NOT EXISTS idx_variants_experiment_id ON variants(experiment_id);

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variants_user_isolation ON variants;
CREATE POLICY variants_user_isolation ON variants
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 8. experiment_metric_snapshots (time-series)
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  reach_ratio numeric,
  reach_actual text,
  reach_threshold text,
  reach_sample_size integer,
  reach_confidence text,
  demand_ratio numeric,
  demand_actual text,
  demand_threshold text,
  demand_sample_size integer,
  demand_confidence text,
  activate_ratio numeric,
  activate_actual text,
  activate_threshold text,
  activate_sample_size integer,
  activate_confidence text,
  monetize_ratio numeric,
  monetize_actual text,
  monetize_threshold text,
  monetize_sample_size integer,
  monetize_confidence text,
  retain_ratio numeric,
  retain_actual text,
  retain_threshold text,
  retain_sample_size integer,
  retain_confidence text,
  channel_metrics jsonb NOT NULL DEFAULT '{}',
  total_clicks integer DEFAULT 0,
  total_spend_cents integer DEFAULT 0,
  avg_cpc_cents integer DEFAULT 0,
  posthog_synced_at timestamptz,
  distribution_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_experiment ON experiment_metric_snapshots(experiment_id, created_at DESC);

ALTER TABLE experiment_metric_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metric_snapshots_user_isolation ON experiment_metric_snapshots;
CREATE POLICY metric_snapshots_user_isolation ON experiment_metric_snapshots
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 9. experiment_decisions (verdict history)
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  decision text NOT NULL CHECK (decision IN ('scale', 'refine', 'pivot', 'kill')),
  reach_ratio numeric,
  reach_confidence text,
  reach_sample_size integer,
  demand_ratio numeric,
  demand_confidence text,
  demand_sample_size integer,
  activate_ratio numeric,
  activate_confidence text,
  activate_sample_size integer,
  monetize_ratio numeric,
  monetize_confidence text,
  monetize_sample_size integer,
  retain_ratio numeric,
  retain_confidence text,
  retain_sample_size integer,
  bottleneck_dimension text,
  bottleneck_recommendation text,
  distribution_roi jsonb,
  reasoning text,
  next_steps text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_decisions_experiment_id ON experiment_decisions(experiment_id);

ALTER TABLE experiment_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS experiment_decisions_user_isolation ON experiment_decisions;
CREATE POLICY experiment_decisions_user_isolation ON experiment_decisions
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 10. experiment_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  alert_type text NOT NULL
    CHECK (alert_type IN ('deploy_failed', 'ad_account_suspended',
           'post_removed', 'budget_exhausted', 'metrics_stale',
           'dimension_dropping', 'bug_auto_fixed')),
  channel text,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_alerts_experiment ON experiment_alerts(experiment_id)
  WHERE resolved_at IS NULL;

ALTER TABLE experiment_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS experiment_alerts_user_isolation ON experiment_alerts;
CREATE POLICY experiment_alerts_user_isolation ON experiment_alerts
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- 11. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL,
  trigger_type text NOT NULL
    CHECK (trigger_type IN ('experiment_live', 'first_traffic',
           'mid_experiment', 'verdict_ready', 'budget_alert',
           'dimension_dropping', 'bug_auto_fixed')),
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'browser_push')),
  scorecard_snapshot jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_user_isolation ON notifications;
CREATE POLICY notifications_user_isolation ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 12. ai_usage
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL,
  skill_name text NOT NULL,
  category text NOT NULL DEFAULT 'analysis'
    CHECK (category IN ('analysis', 'implementation')),
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_experiment_id ON ai_usage(experiment_id);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_usage_user_isolation ON ai_usage;
CREATE POLICY ai_usage_user_isolation ON ai_usage
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 13. user_billing
-- ============================================================
CREATE TABLE IF NOT EXISTS user_billing (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan text NOT NULL DEFAULT 'payg'
    CHECK (plan IN ('payg', 'pro', 'team')),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'none'
    CHECK (subscription_status IN ('none','active','past_due','canceled')),
  creates_used integer NOT NULL DEFAULT 0,
  modifications_used integer NOT NULL DEFAULT 0,
  hosting_used integer NOT NULL DEFAULT 0,
  pool_resets_at timestamptz,
  payg_balance_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_billing_user_isolation ON user_billing;
CREATE POLICY user_billing_user_isolation ON user_billing
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 14. skill_executions (must be before operation_ledger for FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  skill_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'timed_out')),
  input_params jsonb DEFAULT '{}',
  cloud_run_execution_id text,
  gate_type text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_user_id ON skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_experiment_id ON skill_executions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_status ON skill_executions(status) WHERE status IN ('pending', 'running', 'paused');

ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS skill_executions_user_isolation ON skill_executions;
CREATE POLICY skill_executions_user_isolation ON skill_executions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 15. operation_ledger (references skill_executions)
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL,
  skill_execution_id uuid REFERENCES skill_executions(id),
  operation_type text NOT NULL
    CHECK (operation_type IN ('create_l1','create_l2','create_l3',
                              'change','small_fix','hosting','spec_gen')),
  price_cents integer NOT NULL,
  billing_source text NOT NULL
    CHECK (billing_source IN ('pool','payg','free')),
  status text NOT NULL DEFAULT 'authorized'
    CHECK (status IN ('authorized','completed','failed','refunded')),
  token_budget integer,
  actual_tokens_used integer,
  actual_cost_usd numeric,
  classifier_output jsonb,
  parent_operation_id uuid REFERENCES operation_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_operation_ledger_user_created ON operation_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_ledger_billing ON operation_ledger(user_id, billing_source, status)
  WHERE status IN ('authorized', 'completed');

ALTER TABLE operation_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operation_ledger_user_isolation ON operation_ledger;
CREATE POLICY operation_ledger_user_isolation ON operation_ledger
  FOR ALL USING (auth.uid() = user_id);

-- Link ai_usage to operation_ledger
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS operation_id uuid REFERENCES operation_ledger(id);

-- ============================================================
-- 16. oauth_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oauth_tokens_user_isolation ON oauth_tokens;
CREATE POLICY oauth_tokens_user_isolation ON oauth_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 17. distribution_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS distribution_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  channel text NOT NULL
    CHECK (channel IN ('twitter-organic', 'reddit-organic', 'email-resend', 'google-ads', 'meta-ads', 'twitter-ads')),
  campaign_name text NOT NULL,
  campaign_id text,
  campaign_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'paused', 'active', 'completed', 'failed')),
  creative jsonb NOT NULL DEFAULT '{}',
  targeting jsonb NOT NULL DEFAULT '{}',
  utm_source text NOT NULL,
  utm_medium text NOT NULL,
  utm_campaign text NOT NULL,
  budget_cents integer DEFAULT 0,
  spend_cents integer DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  ctr numeric,
  cpc_cents integer,
  metrics_synced_at timestamptz,
  ads_yaml jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribution_campaigns_experiment_id ON distribution_campaigns(experiment_id);
CREATE INDEX IF NOT EXISTS idx_distribution_campaigns_status ON distribution_campaigns(status) WHERE status IN ('draft', 'paused', 'active');

ALTER TABLE distribution_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS distribution_campaigns_user_isolation ON distribution_campaigns;
CREATE POLICY distribution_campaigns_user_isolation ON distribution_campaigns
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS experiments_updated_at ON experiments;
CREATE TRIGGER experiments_updated_at BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS hypotheses_updated_at ON hypotheses;
CREATE TRIGGER hypotheses_updated_at BEFORE UPDATE ON hypotheses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS variants_updated_at ON variants;
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS distribution_campaigns_updated_at ON distribution_campaigns;
CREATE TRIGGER distribution_campaigns_updated_at BEFORE UPDATE ON distribution_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_billing_updated_at ON user_billing;
CREATE TRIGGER user_billing_updated_at BEFORE UPDATE ON user_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RPC: Auto-create user_billing on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_user_billing_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_billing (user_id, plan, payg_balance_cents)
  VALUES (NEW.id, 'payg', 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_billing_on_signup();

-- ============================================================
-- RPC: Atomic PAYG balance decrement
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_payg_balance(
  p_user_id uuid,
  p_amount_cents integer
)
RETURNS integer AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.user_billing
  SET payg_balance_cents = payg_balance_cents - p_amount_cents,
      updated_at = now()
  WHERE user_id = p_user_id
    AND payg_balance_cents >= p_amount_cents
  RETURNING payg_balance_cents INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient PAYG balance'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Free tier experiment quota check
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_experiment_quota(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_plan text;
  experiment_count integer;
  payg_balance integer;
BEGIN
  SELECT plan, payg_balance_cents INTO user_plan, payg_balance
  FROM public.user_billing WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO experiment_count
  FROM public.experiments
  WHERE user_id = p_user_id AND archived_at IS NULL;

  IF user_plan = 'payg' AND payg_balance = 0 AND experiment_count >= 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'free_tier_limit',
      'experiment_count', experiment_count,
      'message', 'Free accounts include 1 experiment. Top up your PAYG balance or upgrade to Pro.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'experiment_count', experiment_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
