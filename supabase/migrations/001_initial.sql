-- Assayer initial bootstrap migration
-- Tables for all experiment.yaml behaviors

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- experiments: Core experiment records (b-18)
-- ============================================================================
CREATE TABLE IF NOT EXISTS experiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'deploying', 'running', 'paused', 'completed', 'archived')),
  verdict text DEFAULT NULL
    CHECK (verdict IS NULL OR verdict IN ('scale', 'refine', 'pivot', 'kill')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
CREATE POLICY "Users can view own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
CREATE POLICY "Users can insert own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
CREATE POLICY "Users can update own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;
CREATE POLICY "Users can delete own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- specs: AI-generated experiment specifications (b-03, b-04, b-05, b-16, b-17)
-- ============================================================================
CREATE TABLE IF NOT EXISTS specs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) DEFAULT NULL,
  experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL DEFAULT NULL,
  idea_text text NOT NULL,
  generated_spec text DEFAULT NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE specs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own specs
DROP POLICY IF EXISTS "Users can view own specs" ON specs;
CREATE POLICY "Users can view own specs" ON specs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Anyone can insert specs (anonymous spec generation)
DROP POLICY IF EXISTS "Anyone can insert specs" ON specs;
CREATE POLICY "Anyone can insert specs" ON specs
  FOR INSERT WITH CHECK (true);

-- Users can update specs they own or unclaimed specs (for claiming)
DROP POLICY IF EXISTS "Users can update own or unclaimed specs" ON specs;
CREATE POLICY "Users can update own or unclaimed specs" ON specs
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own specs
DROP POLICY IF EXISTS "Users can delete own specs" ON specs;
CREATE POLICY "Users can delete own specs" ON specs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- user_billing: Payment and subscription state (b-22, b-23, b-25)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_billing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text DEFAULT NULL,
  stripe_subscription_id text DEFAULT NULL,
  subscription_status text DEFAULT NULL,
  current_period_end timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing" ON user_billing;
CREATE POLICY "Users can view own billing" ON user_billing
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own billing" ON user_billing;
CREATE POLICY "Users can insert own billing" ON user_billing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Billing updates only via service role (bypasses RLS); no authenticated user can update directly
DROP POLICY IF EXISTS "Service can update billing" ON user_billing;
CREATE POLICY "Service can update billing" ON user_billing
  FOR UPDATE USING (false);

-- ============================================================================
-- change_requests: Experiment change requests (b-09)
-- ============================================================================
CREATE TABLE IF NOT EXISTS change_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  change_type text NOT NULL
    CHECK (change_type IN ('pivot_variant', 'adjust_budget', 'extend_timeline', 'pause', 'resume')),
  details text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own change requests" ON change_requests;
CREATE POLICY "Users can view own change requests" ON change_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own change requests" ON change_requests;
CREATE POLICY "Users can insert own change requests" ON change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- skill_executions: Skill execution queue (b-20, b-21)
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_executions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  skill text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'pending_approval', 'approved', 'running', 'completed', 'failed')),
  result jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL
);

ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own skill executions" ON skill_executions;
CREATE POLICY "Users can view own skill executions" ON skill_executions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own skill executions" ON skill_executions;
CREATE POLICY "Users can insert own skill executions" ON skill_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own skill executions" ON skill_executions;
CREATE POLICY "Users can update own skill executions" ON skill_executions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- distribution_campaigns: Distribution campaign config (b-24)
-- ============================================================================
CREATE TABLE IF NOT EXISTS distribution_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'completed', 'failed')),
  budget_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE distribution_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own campaigns" ON distribution_campaigns;
CREATE POLICY "Users can view own campaigns" ON distribution_campaigns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own campaigns" ON distribution_campaigns;
CREATE POLICY "Users can insert own campaigns" ON distribution_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own campaigns" ON distribution_campaigns;
CREATE POLICY "Users can update own campaigns" ON distribution_campaigns
  FOR UPDATE USING (auth.uid() = user_id);
