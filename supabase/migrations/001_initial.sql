-- Assayer initial schema
-- Creates all tables with RLS policies for row-level security.
-- All user-owned tables enforce auth.uid() = user_id.

-- ============================================================
-- specs
-- Stores AI-generated experiment specs. May be anonymous (user_id IS NULL)
-- or user-owned. Anonymous specs older than 24h are cleaned by hourly cron.
-- ============================================================
CREATE TABLE IF NOT EXISTS specs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id),             -- NULL = anonymous
  idea_text   text NOT NULL,
  spec_json   jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own specs" ON specs;
CREATE POLICY "Users can manage their own specs" ON specs
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert anonymous specs" ON specs;
CREATE POLICY "Anyone can insert anonymous specs" ON specs
  FOR INSERT WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Anyone can read anonymous specs" ON specs;
CREATE POLICY "Anyone can read anonymous specs" ON specs
  FOR SELECT USING (user_id IS NULL);

-- ============================================================
-- experiments
-- A launched experiment derived from a spec. Owned by a user.
-- ============================================================
CREATE TABLE IF NOT EXISTS experiments (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id) NOT NULL,
  spec_id            uuid REFERENCES specs(id),
  name               text NOT NULL,
  description        text,
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  verdict            text
                       CHECK (verdict IN ('SCALE', 'REFINE', 'PIVOT', 'KILL')),
  verdict_rationale  text,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own experiments" ON experiments;
CREATE POLICY "Users can manage their own experiments" ON experiments
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- experiment_hypotheses
-- Individual hypotheses tracked within an experiment.
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_hypotheses (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  hypothesis_id  text NOT NULL,  -- e.g. "h-01" from experiment.yaml
  category       text NOT NULL
                   CHECK (category IN ('reach', 'demand', 'activate', 'monetize', 'retain')),
  statement      text NOT NULL,
  threshold      numeric NOT NULL,
  operator       text NOT NULL CHECK (operator IN ('gte', 'lte', 'gt', 'lt', 'eq')),
  formula        text NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'passing', 'failing')),
  score          numeric,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE experiment_hypotheses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage hypotheses of their experiments" ON experiment_hypotheses;
CREATE POLICY "Users can manage hypotheses of their experiments" ON experiment_hypotheses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = experiment_hypotheses.experiment_id
        AND experiments.user_id = auth.uid()
    )
  );

-- ============================================================
-- experiment_variants
-- A/B test variants for an experiment.
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_variants (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  slug           text NOT NULL,
  headline       text NOT NULL,
  subheadline    text,
  cta            text,
  promise        text,
  proof          text,
  urgency        text,
  pain_points    text[] NOT NULL DEFAULT '{}',
  is_control     boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage variants of their experiments" ON experiment_variants;
CREATE POLICY "Users can manage variants of their experiments" ON experiment_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = experiment_variants.experiment_id
        AND experiments.user_id = auth.uid()
    )
  );

-- ============================================================
-- experiment_metrics
-- Funnel metrics synced from PostHog by the 15-min cron.
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_metrics (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  metric_name    text NOT NULL,
  funnel_stage   text NOT NULL
                   CHECK (funnel_stage IN ('reach', 'demand', 'activate', 'monetize', 'retain')),
  value          numeric NOT NULL DEFAULT 0,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE experiment_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage metrics of their experiments" ON experiment_metrics;
CREATE POLICY "Users can manage metrics of their experiments" ON experiment_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = experiment_metrics.experiment_id
        AND experiments.user_id = auth.uid()
    )
  );

-- ============================================================
-- experiment_alerts
-- Budget exhaustion, stale metrics, or dropping dimension alerts.
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_alerts (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  alert_type     text NOT NULL
                   CHECK (alert_type IN ('budget_exhaustion', 'stale_metrics', 'dropping_dimension')),
  severity       text NOT NULL DEFAULT 'warning'
                   CHECK (severity IN ('info', 'warning', 'critical')),
  message        text NOT NULL,
  resolved       boolean NOT NULL DEFAULT false,
  resolved_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE experiment_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage alerts of their experiments" ON experiment_alerts;
CREATE POLICY "Users can manage alerts of their experiments" ON experiment_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = experiment_alerts.experiment_id
        AND experiments.user_id = auth.uid()
    )
  );

-- ============================================================
-- distributions
-- Ad campaign distribution records for an experiment.
-- ============================================================
CREATE TABLE IF NOT EXISTS distributions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  channel        text NOT NULL,        -- e.g. "google", "meta", "reddit"
  campaign_id    text,                 -- external platform campaign ID
  budget_cents   integer NOT NULL DEFAULT 0,
  spent_cents    integer NOT NULL DEFAULT 0,
  impressions    integer NOT NULL DEFAULT 0,
  clicks         integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  synced_at      timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage distributions of their experiments" ON distributions;
CREATE POLICY "Users can manage distributions of their experiments" ON distributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = distributions.experiment_id
        AND experiments.user_id = auth.uid()
    )
  );

-- ============================================================
-- operations
-- Skill execution queue (deploy, distribute, iterate, etc.).
-- ============================================================
CREATE TABLE IF NOT EXISTS operations (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  user_id        uuid REFERENCES auth.users(id) NOT NULL,
  skill          text NOT NULL,  -- e.g. "deploy", "distribute", "iterate"
  status         text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'awaiting_approval', 'approved', 'rejected', 'completed', 'failed')),
  input          jsonb NOT NULL DEFAULT '{}',
  output         jsonb,
  error          text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own operations" ON operations;
CREATE POLICY "Users can manage their own operations" ON operations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- subscriptions
-- Stripe subscription state per user (one row per user).
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    text NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro')),
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'unpaid')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  credits_cents           integer NOT NULL DEFAULT 0,  -- PAYG top-up balance
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own subscription" ON subscriptions;
CREATE POLICY "Users can read their own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own subscription" ON subscriptions;
CREATE POLICY "Users can update their own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- notifications
-- Notifications dispatched to experiment owners by the daily cron.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) NOT NULL,
  experiment_id  uuid REFERENCES experiments(id) ON DELETE SET NULL,
  type           text NOT NULL
                   CHECK (type IN ('milestone', 'verdict', 'alert', 'billing')),
  title          text NOT NULL,
  body           text NOT NULL,
  read           boolean NOT NULL DEFAULT false,
  read_at        timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
CREATE POLICY "Users can manage their own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_specs_user_id ON specs(user_id);
CREATE INDEX IF NOT EXISTS idx_specs_created_at ON specs(created_at);  -- for anonymous cleanup cron
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_experiment_id ON experiment_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_synced_at ON experiment_metrics(synced_at);
CREATE INDEX IF NOT EXISTS idx_experiment_alerts_experiment_id ON experiment_alerts(experiment_id);
CREATE INDEX IF NOT EXISTS idx_distributions_experiment_id ON distributions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_operations_experiment_id ON operations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
