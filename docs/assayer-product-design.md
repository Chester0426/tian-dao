# Assayer — Product Design Document

> **Domain**: assayer.io — "Know if it's gold before you dig."

---

## 1. Levels & Archetypes

```
Idea → Spec → Asset → Traffic → Behavior → Insight → Decision → Next Experiment
```

### Levels

| Level | Name | Funnel dimensions | Shared stack added |
|-------|------|-------------------|-------------------|
| L1 | **Pitch** | REACH + DEMAND | Next.js + hosting + PostHog + shadcn + Playwright |
| L2 | **Prototype** | + MONETIZE | + Supabase |
| L3 | **Product** | + RETAIN | + Auth (+ Stripe if monetize) |

Levels are nested: L2 includes L1, L3 includes L2. Upgrade without rebuild.

### Archetype x Level Matrix

| | L1 (Pitch) | L2 (Prototype) | L3 (Product) |
|--|-----------|----------------|-------------|
| **web-app** | Landing page + variants + analytics | + functional pages + DB | + auth + payments |
| **service** | Landing page + API docs + "Get API Key" CTA | + real API routes + DB | + auth + rate limit + billing |
| **cli** | Landing page + npx stub (opens browser) | + real CLI commands + backend API + DB | + auth token + cloud sync + billing |

**All archetypes at L1 are the same: a Next.js landing page.** Differentiation starts at L2.

> **Agent experiments** use `type: web-app` with `hosting: railway` and `ai: anthropic`.
> An "AI agent" is a web-app whose core behavior is an AI invocation (execution route + results page).
> `/spec` detects agent-like ideas and generates appropriate behaviors and stack choices — no separate archetype needed.
> Rationale: agent experiments need zero different skill steps vs web-app — the differences are content (variant copy describes agent capabilities) and stack (Railway for long-running tasks, AI SDK dependency).

### Stack Principles

- **Runtime is always Next.js.** API routes serve as backend. No Hono/Express during validation.
- **Hosting varies by need.** Vercel (default) for most experiments. Railway for long-running tasks and real-time (persistent runtime). Determined at `/spec` time from behavior analysis.
- **`type` controls generation, not stack.** All archetypes use the same stack structure. `type` determines what `/bootstrap` creates (pages, routes, artifacts).
- **Code grows from L1 to production without rewrite.** Same runtime across all levels. Switching hosting (Vercel→Railway) is a config change, not a code change.
- **`services[]` array from Day 1.** V1 has one service. V3+ can add more. Zero schema migration.

Deployed at `exp-name.assayer.io`.

---

## 2. Architecture

### Skill Execution Model

```
.claude/commands/*.md (single source of logic)
         |
    +---------+
    v         v
  CLI      Agent SDK
(internal) (Cloud Run)
              ^
              |
           Web UI
         (assayer.io)
```

- Internal: Claude Code CLI → skill directly
- External: Web UI → backend → Agent SDK → same skill

### Skills are Stateless Transformers

Skills return JSON. Caller handles persistence. Exception: `/bootstrap`, `/deploy`, `/distribute`, `/teardown` have side effects.

AI-calling skills (`/spec`, `/iterate`): validate with zod, retry once on parse failure, typed error on second failure.

### Interactive Skill Architecture

10 of 12 skills have interactive points (37 total). When the Agent SDK serves external users, these fall into three categories:

| Category | Count | Examples | Platform handling |
|----------|-------|---------|-------------------|
| **Input collection** | ~25 (68%) | Credential prompts, config questions, plan choices | Pre-collected via web forms before skill invocation — zero round trips |
| **Approval gates** | ~12 (32%) | Deploy plan review, bootstrap plan review, PR descriptions | Session resume — skill pauses, UI collects approval, session continues |
| **Credential collection** | subset of input | API keys, OAuth tokens, Stripe keys | Environment variable injection — never through AI |

**Three-layer model:**

1. **Pre-collection** — Web UI gathers all input-collection data (idea text, level, change description, external service decisions) before invoking the skill. The skill receives these as pre-filled context, skipping interactive prompts.
2. **Credential injection** — Platform pre-configures credentials as environment variables in the Cloud Run container. Skills check for env vars before prompting — standard behavior, no mode signal needed.
3. **Session resume** — For approval gates (deploy plan, bootstrap plan), the skill runs until it hits a gate, streams output to the web UI, pauses, and resumes when the user approves or requests changes.

### experiment.yaml vs idea.yaml

| | Assayer platform | Per-experiment |
|---|---|---|
| File | `experiment/idea.yaml` | `experiment/experiment.yaml` |
| Defines | Dashboard, API, auth (assayer.io) | Landing page / demo (exp-name.assayer.io) |
| Written by | Us | `/spec` (generated) |
| Read by | `/bootstrap` for platform | `/bootstrap` for experiment |

> **Prerequisite:** mvp-template rename `idea.yaml` → `experiment.yaml` must complete first.

### Persistence

Supabase = single source of truth. Skills return JSON; caller persists.
- **Web UI path:** Backend invokes skill via Agent SDK → receives JSON → persists to Supabase directly.
- **CLI path:** User runs skill locally → receives JSON output. No automatic platform sync in V1.
- **Future CLI sync:** A thin CLI wrapper could POST results to the Assayer API. Not in scope for MVP.

### Workspace Lifecycle (CLI)

1. `mkdir exp-name && cd exp-name && git init`
2. `/spec` → `experiment/experiment.yaml`
3. `/bootstrap` → project code
4. `/deploy` → live URL
5. Failure: workspace is disposable — re-run from failed step

Agent SDK path (Cloud Run, Docker, credential injection) documented when external users arrive.

### Agent SDK

```typescript
import { query, resumeSession } from "@anthropic-ai/claude-agent-sdk";

// 1. First query — skill runs until approval gate
const session = await query({
  cwd: workspacePath,
  prompt: "/bootstrap",
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
});

// 2. Stream output to web UI while skill runs
for await (const event of session.events) {
  // Forward to client via WebSocket / SSE
}

// 3. Skill pauses at approval gate — session.status === "waiting_for_input"
//    Web UI renders the plan and collects user approval

// 4. Resume session with user's approval
const resumed = await resumeSession({
  sessionId: session.id,
  input: "approve",
});
```

> API shape is illustrative — verify against latest SDK docs.

Runtime: Docker on Cloud Run Jobs (Node.js 20+, all CLIs pre-loaded). Scale-to-zero, 5-15min timeout.

### Authentication

| Method | Provider | Notes |
|--------|----------|-------|
| Email + password | Supabase Auth | TOTP 2FA required |
| Google OAuth | Supabase Auth | `openid email profile` |
| GitHub OAuth | Supabase Auth | Standard |

Login OAuth (Supabase Auth) is independent from API OAuth (Google/Meta Ads). API tokens encrypted via Supabase Vault in `oauth_tokens` table.

### Hosting Model

```
Assayer Platform   →  Vercel (assayer.io) + Supabase
Experiment (default) →  Vercel (exp-name.assayer.io)
Experiment (long-running) →  Railway (exp-name.assayer.io)
```

All experiments share one PostHog project. `global_properties` distinguishes by experiment.

---

## 3. Skills

### 10 Experiment Skills

| # | Skill | Transition | Status |
|---|-------|-----------|--------|
| 1 | `/spec` | Idea + level → experiment.yaml | **New** |
| 2 | `/bootstrap` | experiment.yaml → code | Existing |
| 3 | `/change` | Modify code | Existing |
| 4 | `/verify` | Build + test gate | Existing |
| 5 | `/deploy` | Code → live URL | Existing |
| 6 | `/distribute` | Live → traffic (ad copy, UTM, budget) | **Enhanced** |
| 7 | `/iterate` | Data → scorecard + per-hypothesis verdicts | **Enhanced** |
| 8 | `/teardown` | Remove infra + archive | **Enhanced** |
| 9 | `/harden` | MVP → production quality | Existing |
| 10 | `/retro` | End-of-experiment feedback | Existing |

Supporting (unchanged): `/review`, `/rollback`

### Flow

```
/spec → /bootstrap → /verify → /deploy → /distribute
                                               |
                                          traffic flows
                                               |
                                           /iterate
                                          /    |    \
                                       SCALE REFINE  KILL
                                         |     |      |
                                    (graduate) |      /teardown
                                               |
                                      +--------+--------+
                                      | Same level:     |
                                      |  /change        |
                                      |  → /distribute  |
                                      |                 |
                                      | Upgrade level:  |
                                      |  /spec (L+1)    |
                                      |  → /bootstrap   |
                                      |  → /deploy      |
                                      +-----------------+
                      PIVOT = KILL current + new /spec
```

### `/spec` — Idea + Level → experiment.yaml

**Model:** Opus | **Input:** `{ idea: string, level?: 1|2|3 }` | **Output:** `experiment/experiment.yaml`

**experiment.yaml schema** (7 sections):

```yaml
# 1. Identity
name: ai-invoice-tool                    # kebab-case
type: web-app                            # web-app | service | cli
level: 1                                 # 1 (Pitch), 2 (Prototype), 3 (Product)
status: draft
# quality: production                    # Build config — toggles TDD, implementer, spec review

# 2. Intent
description: |                           # 2-3 sentences for landing page copy
  Freelancers waste hours on manual invoicing. An AI tool that generates
  professional invoices from time logs in under 60 seconds.
thesis: "Freelancers want AI-generated invoices"
target_user: "Solo freelancers, US/EU"
distribution: "Google Ads targeting freelancer invoice keywords"
hypotheses:                               # inline, not in separate manifest
  - id: h-01
    category: demand
    statement: "Freelancers actively search for AI invoice tools"
    success_metric: "Signup conversion rate"
    threshold: "> 5% signup rate from 500+ visitors"
    priority_score: 90                   # 0-100
    experiment_level: 1
    depends_on: []
  # ... 5-10 hypotheses

# 3. Behaviors (unified: user + system actors)
behaviors:
  # User behavior (actor: user is default, omit)
  - id: b-01
    given: "A freelancer lands on the pitch page"
    when: "They read the headline and subheadline"
    then: "They understand the value proposition within 5 seconds"
    tests:
      - "Landing page renders without errors"
      - "Headline matches active variant"
    hypothesis_id: h-01
    level: 1
  # System behavior
  - id: b-05
    actor: system                         # system | cron (default: user)
    trigger: "stripe webhook checkout.session.completed"
    given: "A Stripe checkout session completes"
    when: "Webhook is received"
    then: "Invoice marked paid, freelancer notified"
    tests:
      - "invoices table has status='paid'"
    hypothesis_id: h-03
    level: 3

# 4. Journey
golden_path:
  - step: "Visit landing page"
    event: visit_landing
    page: landing
  - step: "Click CTA"
    event: cta_click
    page: landing
  - step: "Complete signup"
    event: signup_complete
    page: landing
target_clicks: 3

# 5. Variants (3-5 A/B messaging angles)
variants:
  - slug: time-saver
    headline: "Save 5 Hours Every Week on Invoicing"
    subheadline: "AI generates professional invoices from your time tracking data"
    cta: "Start Free Trial"
    pain_points: ["Manual invoicing wastes hours", "Formatting inconsistencies"]
    promise: "Professional invoices in seconds"
    proof: "Used by 500+ freelancers"
    urgency: null

# 6. Funnel
funnel:
  reach:
    metric: "Ad CTR"
    threshold: "> 2%"
    available_from: L1
  demand:
    metric: "Signup conversion rate"
    threshold: "> 5%"
    available_from: L1
  monetize:
    metric: "Pricing page clicks"
    threshold: "> 7%"
    available_from: L2
  retain:
    metric: "7-day return rate"
    threshold: "> 30%"
    available_from: L3
decision_framework:
  scale: "All tested dimensions >= threshold"
  refine: "Bottleneck ratio >= 0.7"
  pivot: "Bottleneck ratio < 0.7"
  kill: "Top-funnel (REACH or DEMAND) < 0.5"

# 7. Stack + Deploy
services:
  - name: app
    runtime: nextjs                      # always Next.js for validation
    hosting: vercel                      # or railway (long-running, real-time)
    ui: shadcn
    testing: playwright
database: supabase                       # L2+ (shared across services)
auth: supabase                           # L3 (shared)
# auth_providers: [google]               # OAuth providers
analytics: posthog                       # shared
# payment: stripe                        # L3 if monetize
deploy:
  url: null
  repo: null
```

**Schema design decisions:**

| Field | Placement | Reason |
|-------|----------|--------|
| `type` | Section 1 | Archetype changes golden path, funnel shape, behavior types |
| `quality` | Outside sections (build config) | Process decision, not experiment definition |
| `critical_flows` | Absorbed into Section 3 | System behaviors use `actor: system` + `trigger` |
| `auth_providers` | Section 7 under auth | Stack implementation detail |
| `description` | Section 2 | Landing page copy, replaces old `problem` + `solution` |
| `services[]` | Section 7 | V1: array of 1. V3+: array of N. Zero schema migration. |
| `runtime` (not `framework`) | Per-service | Semantically accurate: describes execution model, not library |

**`/spec` phases:**

1. **Parse** — idea text + level (default 1). Validate >= 20 chars.
2. **Input sufficiency** — Assess 3 dimensions (target user, problem, solution shape). Each: present / inferable / missing. All present → zero delay. 1 missing → one follow-up round with "proceed" escape. 2-3 missing → ask user to elaborate.
3. **Pre-flight research** — 4 dimensions: market, problem, competition, ICP. Verdict per dimension (pass/caution/fail). Stop on 2+ failures.
4. **Hypotheses** — 5-10 across demand/reach/feasibility/monetize/retain. Filter by level. Priority 0-100. L1: demand+reach required. L2: +feasibility+retain. L3: all five. Monetize at L2+.
5. **Behaviors** — given/when/then + `tests[]` array. User behaviors default. System behaviors: `actor: system` + `trigger` field.
6. **Variants** — 3-5 angles, >30% headline word difference. L3 + monetize: add `pricing_amount`, `pricing_model`.
7. **Stack/funnel** — Stack from level (Section 1 table). Hosting from type + behavior analysis. Funnel thresholds from highest-priority hypothesis per dimension.

**Manifest:** `.claude/spec-manifest.json` with research, hypotheses, cluster data. For `/iterate`. Not user-facing.

### `/iterate` — Scorecard + Per-Hypothesis Verdicts

Per hypothesis: map `success_metric` → funnel metric, compare against `threshold`.
Verdict: CONFIRMED / REJECTED / INCONCLUSIVE.

**Scorecard:** 4 funnel dimensions as actual/threshold ratios. FEASIBILITY = build-time gate (checked by `/spec`), not runtime.

| Dimension | Measured via | From |
|-----------|-------------|------|
| **REACH** | ad CTR, impressions, CPC | L1+ |
| **DEMAND** | CTA rate, signup rate, engagement | L1+ |
| **MONETIZE** | pricing interaction, payment intent | L2+ |
| **RETAIN** | return visits, repeat usage, churn | L3+ |

Confidence per dimension: <30 events `insufficient`, 30-100 `directional`, 100-500 `reliable`, 500+ `high`.

Decision: walk funnel top-down, first dimension below threshold = **bottleneck**.

| Condition | Decision |
|-----------|----------|
| All tested dimensions >= 1.0 | SCALE |
| Bottleneck ratio >= 0.7 | REFINE |
| Bottleneck ratio < 0.7 | PIVOT |
| REACH or DEMAND < 0.5 | KILL |

**Two-tier verdict approach:** The template uses a more sophisticated two-tier model than the single ratio table above. Tier 1 (Step 3): pace-based overall verdict using `target_pct / time_pct` — produces TOO EARLY, SCALE, REFINE, PIVOT, or KILL. Tier 2 (Step 4 Scorecard): per-dimension ratio analysis against thresholds — identifies the specific bottleneck. The `decision_framework` field in experiment.yaml is human-readable documentation of the operator's decision criteria, not algorithmic input.

**Custom funnel mapping:** For service/cli archetypes with `funnel_template: custom`, custom events map to the 4 standard dimensions: `api_call`/`command_run` → REACH, `activate` → DEMAND, `pay_*` → MONETIZE, `retain_return` → RETAIN.

**Dependency-aware verdicts:** Per-hypothesis verdicts respect `depends_on[]` — if a parent hypothesis is REJECTED, dependent hypotheses are marked BLOCKED (not evaluated).

---

## 4. API & Data Flow

### Routes

```
GET    /api/experiments                    — list (paginated)
GET    /api/experiments/:id                — get single
POST   /api/experiments                    — create
PATCH  /api/experiments/:id                — update status/url/decision
DELETE /api/experiments/:id                — soft delete (archived_at)

POST   /api/experiments/:id/hypotheses     — store (mode: append|replace)
GET    /api/experiments/:id/hypotheses     — list

POST   /api/experiments/:id/offers         — store variants
GET    /api/experiments/:id/offers         — list

POST   /api/experiments/:id/insights       — store scorecard + decision
GET    /api/experiments/:id/insights       — list history

POST   /api/experiments/:id/research       — store research results
GET    /api/experiments/:id/research       — list

POST   /api/experiments/:id/metrics/sync   — query PostHog, cache
GET    /api/experiments/:id/metrics        — cached metrics

POST   /api/experiments/:id/spec           — AI generation (NOT persisted)
```

Pagination: `?page=1&limit=20` (max 100). Sub-resource POST: `mode=append` (default) or `mode=replace`.

### Error Schema

```json
{ "error": { "code": "validation_error", "message": "...", "details": {} } }
```

Codes: `validation_error`, `not_found`, `unauthorized`, `rate_limited`, `ai_error`, `internal_error`.

### Data Flow

```
/spec → experiment.yaml + spec-manifest.json
  ↓
User reviews/edits
  → POST hypotheses (replace) + POST research + POST offers
  ↓
/bootstrap → code
  ↓
/deploy → PATCH { status: "active", deployed_url }
  ↓
PostHog ← events
  ↓
POST metrics/sync → cache
  ↓
/iterate → POST insights + PATCH hypothesis statuses
```

### Metrics Cache

`POST metrics/sync` queries PostHog only if `fetched_at` > 15min. `?force=true` bypasses.

### Env Vars

```
ASSAYER_API_KEY=<service-key>         # backend service key for protecting API routes
```

---

## 5. Data Model

```sql
-- Experiments
CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  experiment_type text NOT NULL DEFAULT 'web-app'
    CHECK (experiment_type IN ('web-app', 'service', 'cli')),
  idea_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  experiment_level integer CHECK (experiment_level IN (1, 2, 3)),
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
  archived_at timestamptz,                      -- soft delete
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiments_user_id ON experiments(user_id);
CREATE INDEX idx_experiments_status ON experiments(status) WHERE archived_at IS NULL;

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY experiments_user_isolation ON experiments
  FOR ALL USING (auth.uid() = user_id);

-- Clusters (first-class entity from /spec)
CREATE TABLE clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  cluster_key text NOT NULL,                    -- "c-01"
  experiment_level integer NOT NULL CHECK (experiment_level IN (1, 2, 3)),
  stimulus_format text,                        -- L2 only: "calculator", "configurator", etc.
  estimated_cost numeric DEFAULT 0,
  estimated_days integer DEFAULT 0,
  recommended_ad_budget numeric DEFAULT 0,
  caution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, cluster_key)
);

CREATE INDEX idx_clusters_experiment_id ON clusters(experiment_id);

ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY clusters_user_isolation ON clusters
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- Hypotheses
CREATE TABLE hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  hypothesis_key text NOT NULL,                 -- "h-01"
  category text NOT NULL
    CHECK (category IN ('demand', 'reach', 'feasibility', 'monetize', 'retain')),
  statement text NOT NULL,
  test_method text,
  success_metric text,
  threshold text,
  estimated_cost numeric DEFAULT 0,
  priority_score integer DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
  result text,
  experiment_level integer CHECK (experiment_level IN (1, 2, 3)),
  automation_type text NOT NULL DEFAULT 'experiment'
    CHECK (automation_type IN ('research', 'experiment', 'manual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'testing', 'passed', 'failed', 'skipped')),
  cluster_id uuid REFERENCES clusters(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, hypothesis_key)
);

CREATE INDEX idx_hypotheses_experiment_id ON hypotheses(experiment_id);
CREATE INDEX idx_hypotheses_cluster_id ON hypotheses(cluster_id);

ALTER TABLE hypotheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY hypotheses_user_isolation ON hypotheses
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- Hypothesis dependencies
CREATE TABLE hypothesis_dependencies (
  hypothesis_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  depends_on_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  PRIMARY KEY (hypothesis_id, depends_on_id),
  CHECK (hypothesis_id != depends_on_id)
);

-- Research results
CREATE TABLE research_results (
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

CREATE INDEX idx_research_results_experiment_id ON research_results(experiment_id);

ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_results_user_isolation ON research_results
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- Variants
CREATE TABLE variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
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
  UNIQUE(experiment_id, slug)
);

CREATE INDEX idx_variants_experiment_id ON variants(experiment_id);

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY variants_user_isolation ON variants
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- Experiment metrics (cached from PostHog)
CREATE TABLE experiment_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'posthog',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, metric_name, period_start, period_end)
);

CREATE INDEX idx_experiment_metrics_experiment_id ON experiment_metrics(experiment_id);

ALTER TABLE experiment_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY experiment_metrics_user_isolation ON experiment_metrics
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- Experiment decisions (scorecard history from /iterate)
CREATE TABLE experiment_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('scale', 'refine', 'pivot', 'kill')),
  reach_ratio numeric,
  reach_confidence text,
  reach_sample_size integer,
  demand_ratio numeric,
  demand_confidence text,
  demand_sample_size integer,
  monetize_ratio numeric,
  monetize_confidence text,
  monetize_sample_size integer,
  retain_ratio numeric,
  retain_confidence text,
  retain_sample_size integer,
  bottleneck_dimension text,
  bottleneck_recommendation text,
  reasoning text,
  next_steps text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiment_decisions_experiment_id ON experiment_decisions(experiment_id);

ALTER TABLE experiment_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY experiment_decisions_user_isolation ON experiment_decisions
  FOR ALL USING (
    experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
  );

-- AI usage tracking
CREATE TABLE ai_usage (
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

CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_experiment_id ON ai_usage(experiment_id);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_user_isolation ON ai_usage
  FOR ALL USING (auth.uid() = user_id);

-- OAuth tokens (for Google/Meta Ads API connections)
CREATE TABLE oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL,                       -- "google_ads", "meta_ads"
  access_token text NOT NULL,                   -- encrypted via Supabase Vault
  refresh_token text,                           -- encrypted via Supabase Vault
  expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY oauth_tokens_user_isolation ON oauth_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER experiments_updated_at BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER hypotheses_updated_at BEFORE UPDATE ON hypotheses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Status Transitions

**Experiment:** `draft → active → paused → active` | `active → completed → archived` | `active → archived (kill)` | `draft → archived (abandon)`

- `draft → active`: `/deploy` succeeds
- `active → paused`: user action
- `active → completed`: `/iterate` returns SCALE or KILL
- `* → archived`: `/teardown` or user action

**Hypothesis:** `pending → testing → passed/failed/skipped`

- `pending → testing`: experiment becomes `active`
- `testing → passed/failed`: `/iterate` verdict
- `* → skipped`: user manually skips

### Pages (Assayer Platform)

```yaml
pages:
  - name: landing        # Product intro + signup
  - name: dashboard      # Experiment overview + portfolio
  - name: new-experiment # Create wizard (idea + level → spec → deploy)
  - name: experiment     # Detail (tabs: overview, hypotheses, variants, data, insights)
  - name: settings       # Account, billing
```

---

## 6. Build Order

| # | What | Method | Depends On |
|---|------|--------|-----------|
| 0 | Infrastructure setup | manual | — |
| 0.5 | Rename `idea.yaml` → `experiment.yaml` (66 files) | direct edit | — |
| 1 | Create `spec.md` | direct file creation | #0.5 |
| 2 | Enhance `iterate.md` (per-hypothesis verdicts) | direct edit | — |
| 3 | Minor updates to `distribute.md` | direct edit | #1 |
| 4 | Update Assayer `idea.yaml` | manual edit | #1-2 |
| 5 | `/bootstrap` Assayer platform | /bootstrap | #4 |
| 6 | `/change`: error schema + API key auth | /change | #5 |
| 7 | `/change`: experiments + hypotheses + clusters CRUD | /change | #6 |
| 8 | `/change`: research + offers + metrics + AI spec endpoint | /change | #6 |
| 9 | `/change`: new experiment page (AI generation + editing) | /change | #7-8 |
| 10 | `/change`: dashboard + experiment detail pages | /change | #7-8 |
| 11 | `/change`: PostHog metrics sync (15min cache) | /change | #7 |
| 12 | `/harden` + `/verify` | /harden, /verify | #9-11 |
| 13 | `/deploy` | /deploy | #12 |
| 14 | First real experiment | manual | #13 |

**Parallelism:** #2+#3 parallel with #1. #7+#8 parallel. #9+#10+#11 parallel.

### Skill-to-Skill Data Flow

```
/spec        → writes experiment/experiment.yaml + .claude/spec-manifest.json
/bootstrap   → reads experiment/experiment.yaml
/iterate     → reads .claude/spec-manifest.json → writes .claude/iterate-manifest.json
```

Manifests committed to experiment repo — persist across sessions.

### Infrastructure (Day 0)

| What |
|------|
| Supabase project (platform DB + Auth) |
| Google OAuth + GitHub OAuth apps (for Supabase Auth) |
| PostHog project (shared for platform + experiments) |
| Stripe account + test products |
| assayer.io domain + wildcard DNS + SSL → Vercel |
| Vercel Pro account |
| Sentry (Next.js integration) |
| GitHub Actions CI (build + lint + test) |

### Future Additions (build when triggered)

| Feature | Trigger |
|---------|---------|
| `/assay` orchestrator | Users ask for "one command" |
| Auto-sequencing | 20+ experiments in DB |
| Benchmark database | 100+ experiments in DB |
| Google/Meta Ads API write | Manual campaign creation bottleneck |
| Agent SDK on Cloud Run | External users arrive |
| Upstash rate limiting | External API exposure |
| Pricing tiers + Stripe | ai_usage data + external users |
| Experiment comparison view | 5+ experiments per user |
| PostHog project sharding | 100+ experiments, perf degrades |

---

## 7. Constraints

- Opus for all AI skills. Quality over cost.
- Token budget in `ai_usage` from Day 1: analysis (`/spec`, `/iterate`) $5/experiment cap, implementation tracked but uncapped.
- AI skills: zod validation, retry once, typed error on second failure.
- Show sample size alongside every metric. Never auto-decide with <100 clicks.
- User can preview and edit AI content before deployment.
- Rate limit `/api/experiments/:id/spec` from Day 1 — in-memory counter.

---

## 8. UX Reference

### CLI — After /spec

```
/spec "AI-powered invoice tool for freelancers"

Pre-flight checks                                    4/4 passed
------------------------------------------------------------------
[ok] Market exists        Freelancer invoicing: $4.2B TAM          (confidence: high)
[ok] Problem validated    340+ forum threads                       (confidence: high)
[ok] Competitors found    None use AI generation                   (confidence: medium)
[ok] ICP identifiable     Solo freelancers, US/EU                  (confidence: high)

Level: L1 Pitch (default)
Build: $150  Ad budget: $200  Time: 7 days

Hypotheses:
  REACH      "Ad CTR > 2% for freelancer invoice keywords"  -> CTR
  DEMAND     "Freelancers search for invoice automation"     -> signup rate
  MONETIZE   "Freelancers will pay $19/mo"                   -> pricing clicks

Behaviors (3):
  b-01  Given a freelancer lands -> they understand the value prop      (L1)
  b-02  Given interest -> CTA click enters signup flow                  (L1)
  b-03  Given pricing shown -> they interact with pricing options       (L1)

Variants (3):
  "time-saver"    Save 5 Hours Every Week on Invoicing
  "ai-magic"      Your AI Invoicing Assistant
  "cost-cutter"   Cut Invoicing Costs by 80%

Wrote experiment/experiment.yaml
Run /bootstrap to scaffold, or edit experiment.yaml first to adjust.
To test at L2/L3, run: /spec "AI-powered invoice tool" --level 2
```

### CLI — After /iterate

```
RESULTS -- Experiment #1 (L1 Pitch)
=============================================

Funnel scorecard:
  REACH      1.90  ##################..  CTR 3.8% / 2.0%         (reliable -- 523 impressions)
  DEMAND     1.34  ################....  6.7% signup / 5.0%      (reliable -- 523 visitors)
  MONETIZE   0.65  #############.......  4.5% clicks / 7.0%      (directional -- 89 clicks)
  RETAIN     --    (not tested -- requires L3)

! Bottleneck: MONETIZE (ratio 0.65). Pricing click rate 4.5% vs 7.0% threshold.
  Consider: test lower price points or add value justification.

Hypothesis verdicts:
  REACH      CTR 3.8% vs 2.0% threshold     PASS  (reliable -- 523 impressions)
  DEMAND     6.7% signup vs 5.0%             PASS  (reliable -- 523 visitors)
  MONETIZE   4.5% pricing clicks vs 7.0%     FAIL  (directional -- 89 clicks)

VERDICT: REFINE (bottleneck MONETIZE at 0.65)
Recommended: Adjust pricing/value prop, then upgrade to L2 for deeper engagement data
```

### Web UI — New Experiment (2-Step Wizard)

```
Step 1 -- Describe:

+------------------------------------------------------------+
|  Your idea: "AI-powered invoice tool for freelancers"       |
|                                                             |
|  Or try an example:                                         |
|  [AI resume builder] [Meal prep planner] [SaaS analytics]   |
|                                                             |
|  Type: [web-app v] [service] [cli]                          |
|  Level: [L1 Pitch v]  [L2 Prototype]  [L3 Product]         |
|                                                             |
|  [Generate Spec]                                            |
+------------------------------------------------------------+

Step 2 -- Review & Create:

+------------------------------------------------------------+
|  ai-invoice-tool -- L1 Pitch -- web-app                     |
|  Build: $150  Ad budget: $200  Time: 7 days                 |
|                                                             |
|  Pre-flight checks:                        4/4 passed       |
|  [ok] Market  [ok] Problem  [ok] Competition  [ok] ICP      |
|                                                             |
|  Hypotheses (3):                                            |
|  | REACH     "Ad CTR > 2%"              -> CTR            | |
|  | DEMAND    "Signup rate > 5%"          -> signups        | |
|  | MONETIZE  "Pricing clicks > 7%"      -> clicks         | |
|                                                             |
|  Behaviors (3):                                             |
|  b-01  Given landing -> understand value prop      (L1)     |
|  b-02  Given interest -> CTA enters signup         (L1)     |
|  b-03  Given pricing -> interact with options      (L1)     |
|                                                             |
|  Variants (3):                                              |
|  "time-saver" | "ai-magic" | "cost-cutter"                  |
|                                                             |
|  All AI-generated fields are editable -- click any value    |
|  to modify. [Regenerate]                                    |
|                                                             |
|  [Create Experiment]                                        |
+------------------------------------------------------------+

Single API call: POST /api/experiments/:id/spec
```

### Web UI — Monitoring

```
+------------------------------------------------------------+
|  AI Invoice Tool          ACTIVE   Day 3/7   L1 Pitch       |
|                                                             |
|  Impressions: 2,340  Clicks: 89  Spend: $62                 |
|                                                             |
|  REACH     CTR 3.8% / 2.0%  ################ 1.90  PASS    |
|  DEMAND    6.7% signup / 5.0% ##############. 1.34  PASS    |
|  MONETIZE  4.5% clicks / 7.0% #########..... 0.65  LOW     |
|  RETAIN    -- (requires L3)                                  |
|                                                             |
|  [Pause]  [View Site]  [Analyze Early]  [Upgrade to L2]     |
+------------------------------------------------------------+
```
