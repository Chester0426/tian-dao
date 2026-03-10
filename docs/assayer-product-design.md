# Assayer — Product Design Document

> **Domain**: assayer.io — "Know if it's gold before you dig."

---

## 1. Core Loop

```
Idea → Spec → Asset → Traffic → Behavior → Insight → Decision
  ^                                                                        |
  +---------------------------- Next Experiment <--------------------------+
```

Each experiment has a **level** that determines scope and fidelity:

| Level | Name | What it tests | Stack |
|-------|------|---------------|-------|
| L1 | **Pitch** | Is there interest? | Static page + PostHog |
| L2 | **Prototype** | Will they engage? | + Supabase (signup, fake-door interactions) |
| L3 | **Product** | Will they use and retain? | Full template stack (auth, functional demo) |

Levels are **nested**: L2 includes everything from L1, L3 includes everything from L2. An experiment can be **upgraded** from L1→L2→L3 without rebuilding — each level adds capabilities on top of the previous one. Deployed at `exp-name.assayer.io`.

---

## 2. Architecture

### Skill Execution Model

```
.claude/commands/*.md (single source of logic)
         |
    ┌────┴────┐
    v         v
  CLI      Agent SDK
(internal) (Cloud Run)
              ^
              |
           Web UI
         (assayer.io)
```

- Internal team: Claude Code CLI → runs skill directly
- External users: Web UI → Assayer backend → Agent SDK → runs same skill
- **Web UI is above Agent SDK, not parallel to it**

### Skills are Stateless Transformers

Skills return structured JSON. They do NOT write to databases or call persistence APIs. The **caller** handles persistence.

**Exception:** `/bootstrap`, `/deploy`, `/distribute`, `/teardown` have filesystem/infrastructure side effects.

**Error handling for AI-calling skills:** Every skill that calls Claude (`/spec`, `/iterate`) must: (1) validate output with a zod schema, (2) retry once on parse failure with a more constrained prompt, (3) return a typed error object on second failure — never crash.

### experiment.yaml vs idea.yaml

The mvp-template uses `experiment.yaml` as the experiment configuration file. Assayer uses `idea.yaml` for its own platform definition.

| | Assayer platform | Per-experiment |
|---|---|---|
| File | `idea/idea.yaml` | `idea/experiment.yaml` |
| Defines | Dashboard, API, auth (assayer.io) | Landing page / demo (exp-name.assayer.io) |
| Written by | Us (manually) | `/spec` skill (generated from hypothesis) |
| Read by | `/bootstrap` for platform code | `/bootstrap` for experiment asset |

Different file names eliminate collision risk. `/spec` generates `experiment.yaml`; it cannot accidentally overwrite the platform's `idea.yaml`.

> **Prerequisite:** mvp-template global rename `idea.yaml` → `experiment.yaml` (66 files) must complete before implementing new skills.

### DB is the Persistent Store

- Supabase is the single source of truth for all experiment state
- Skills return JSON; the caller persists to DB
- CLI mode: stateless output to console; use API key + `ASSAYER_URL` for persistence

### Workspace Lifecycle (CLI Path)

Current phase uses CLI exclusively. The workflow for each experiment:

1. **Create workspace:** `mkdir exp-name && cd exp-name && git init`
2. **Generate config:** `/spec` writes `idea/experiment.yaml` to the workspace
3. **Scaffold:** `/bootstrap` reads `experiment.yaml`, generates project code, commits
4. **Deploy:** `/deploy` pushes to GitHub, deploys to Vercel, records `deployed_url`
5. **Failure:** If any step fails, the workspace is disposable — delete and re-run from the failed step

Agent SDK path (Cloud Run, Docker, credential injection) will be documented when external users arrive.

### Agent SDK Integration

```typescript
import { Claude } from "@anthropic-ai/claude-code";

const claude = new Claude({ cwd: workspacePath });
const result = await claude.sendMessage("/bootstrap", {
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
});
```

> API shape is illustrative — verify against latest Claude Code SDK docs before implementation.

Execution environment: Docker image on Google Cloud Run Jobs (Node.js 20+, npm, git, gh, vercel CLI, supabase CLI, Agent SDK, template files pre-loaded). Scale-to-zero, 5-15min task timeout.

### Authentication

| Method | Provider | Notes |
|--------|----------|-------|
| Email + password | Supabase Auth | TOTP 2FA required |
| Google OAuth login | Supabase Auth | `openid email profile` scope |
| GitHub OAuth login | Supabase Auth | Standard |

Login OAuth (Supabase Auth) is independent from API OAuth (Google/Meta Ads account connection). API tokens stored encrypted in `oauth_tokens` table via Supabase Vault.

### Hosting Model

```
Assayer Platform  →  Vercel (assayer.io) + Supabase
Experiment A      →  Vercel (exp-a.assayer.io), no DB (landing page)
Experiment B      →  Vercel (exp-b.assayer.io) + Supabase (signup flow)
Experiment C      →  Vercel (exp-c.assayer.io) + Supabase (functional demo)
```

All experiments share one PostHog project. Template `global_properties` distinguishes events by experiment.

---

## 3. Skills

### 10 Experiment Skills

| # | Skill | State Transition | Status |
|---|-------|-----------------|--------|
| 1 | `/spec` | Idea text + level → experiment.yaml (hypotheses, behaviors, variants, stack) | **New** |
| 2 | `/bootstrap` | experiment.yaml → Project code | Existing |
| 3 | `/change` | Modify experiment code (pivot) | Existing |
| 4 | `/verify` | Build + test quality gate | Existing |
| 5 | `/deploy` | Code → Live URL | Existing |
| 6 | `/distribute` | Live → Traffic (ad copy, UTM, channel rec, budget) | **Enhanced** |
| 7 | `/iterate` | Traffic data → Insights + scorecard + per-hypothesis verdicts | **Enhanced** |
| 8 | `/teardown` | Remove infrastructure + archive | **Enhanced** |
| 9 | `/harden` | MVP → Production quality mode | Existing |
| 10 | `/retro` | End-of-experiment structured feedback | Existing |

Supporting skills (unchanged): `/review`, `/rollback`

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
                                      ┌────────┴────────┐
                                      │ Same level:     │
                                      │  /change        │
                                      │  → /distribute  │
                                      │                 │
                                      │ Upgrade level:  │
                                      │  /spec (L+1)    │
                                      │  → /bootstrap   │
                                      │  → /deploy      │
                                      └─────────────────┘
                      PIVOT = KILL current + new /spec
```

### `/spec` — Idea Text + Level → Complete experiment.yaml

**Model:** Opus

**Input:**
```typescript
{
  idea: string;           // Free-text idea description
  level?: 1 | 2 | 3;     // Experiment level (default: 1)
}
```

**Output:** Complete `idea/experiment.yaml` content for `/bootstrap` to consume.

**experiment.yaml schema** (7 sections):

```yaml
# 1. Identity
name: ai-invoice-tool                    # kebab-case
level: 1                                 # 1 (Pitch), 2 (Prototype), 3 (Product)
status: draft

# 2. Intent
thesis: "Freelancers want AI-generated invoices"
target_user: "Solo freelancers, US/EU"
distribution: "Google Ads targeting freelancer invoice keywords"
hypotheses:                               # inline — no separate manifest
  - id: h-01
    category: demand
    statement: "Freelancers actively search for AI invoice tools"
    success_metric: "Signup conversion rate"
    threshold: "> 5% signup rate from 500+ visitors"
    priority_score: 90
    experiment_level: 1
    depends_on: []
  # ... 5-10 hypotheses

# 3. Behaviors (replaces features — given/when/then with hypothesis traceability)
behaviors:
  - id: b-01
    given: "A freelancer lands on the pitch page"
    when: "They read the headline and subheadline"
    then: "They understand the value proposition within 5 seconds"
    tests:
      - "Landing page renders without errors"
      - "Headline matches active variant"
    hypothesis_id: h-01                   # traces back to hypothesis
    level: 1                              # minimum level needed
  - id: b-02
    given: "A freelancer is interested in the product"
    when: "They click the primary CTA"
    then: "They enter the signup flow"
    tests:
      - "CTA click fires signup_start event"
      - "Signup form renders after click"
    hypothesis_id: h-02
    level: 1

# 4. Journey (golden path with events)
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

# 5. Variants (A/B messaging, 3-5 variants)
variants:
  - slug: time-saver
    headline: "Save 5 Hours Every Week on Invoicing"
    subheadline: "AI generates professional invoices from your time tracking data"
    cta: "Start Free Trial"
    pain_points: ["Manual invoicing wastes hours", "Formatting inconsistencies"]
    promise: "Professional invoices in seconds"
    proof: "Used by 500+ freelancers"
    urgency: null
  # ... 3-5 variants, each testing a different angle

# 6. Funnel (thresholds + decision framework)
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
  scale: "All tested dimensions ≥ threshold"
  refine: "Bottleneck ratio ≥ 0.7"
  pivot: "Bottleneck ratio < 0.7"
  kill: "Top-funnel (REACH or DEMAND) < 0.5"

# 7. Stack (deterministic from level) + Deploy (filled later)
stack:
  framework: nextjs
  hosting: vercel
  analytics: posthog
  ui: shadcn
  # database: supabase       — added at L2+
  # auth: supabase           — added at L3
deploy:
  url: null                   # filled by /deploy
  repo: null
  vercel_project_id: null
```

**Key behaviors** (6 phases):

1. **Parse input:** Extract idea text from `$ARGUMENTS`. If level not specified, default to 1 (Pitch). Validate idea text is >= 20 characters.
2. **Pre-flight research:** Analyze the idea across 4 dimensions (market existence, problem validation, competitive landscape, ICP identification). Each produces a research result with finding, sources, confidence, and verdict. Present as "pre-flight checks" summary.
3. **Hypothesis generation:** Generate 5-10 hypotheses across categories (demand, reach, feasibility, monetize, retain). Each has: id, category, statement, success_metric, threshold, priority_score, experiment_level, depends_on. Mark research-type hypotheses as resolved.
4. **Behavior derivation:** Convert each experiment-type hypothesis's `test_method` into given/when/then behaviors with `tests[]` array and `level` annotation. Behaviors replace vague feature one-liners with testable specifications.
5. **Variant generation:** Generate 3-5 offer variants, each testing a meaningfully different angle (>30% word difference in headlines). Include: slug, headline, subheadline, CTA, pain_points, promise, proof, urgency.
6. **Stack/funnel determination:** Set stack deterministically from level (L1: static, L2: + Supabase, L3: + auth). Set funnel thresholds from highest-priority hypothesis per dimension.

**Internal manifest:** Writes `.claude/spec-manifest.json` containing the full intermediate data (hypotheses, research results, cluster info) for `/iterate` to consume. This manifest is not user-facing — the user sees only experiment.yaml.

### `/iterate` — Enhanced with Per-Hypothesis Verdicts

In addition to the 4-dimension funnel scorecard and overall verdict:

- For each hypothesis, map its `success_metric` to the closest funnel metric
- Compare actual metric against `threshold`
- Produce per-hypothesis verdict: CONFIRMED / REJECTED / INCONCLUSIVE
- Sample size qualifiers:
  - <30 visitors → "insufficient data"
  - 30-100 → "directional signal"
  - 100-500 → "reliable"
  - 500+ → "high confidence"

### Validation Scorecard (produced by /iterate)

Four funnel dimensions scored as **actual/threshold ratios**. FEASIBILITY is a build-time gate (checked by `/spec`), not a runtime metric.

| Dimension | Funnel Position | Measured via | Available from |
|-----------|----------------|-------------|----------------|
| **REACH** | Top | ad CTR, impression volume, cost-per-click | L1+ |
| **DEMAND** | Middle | CTA click rate, signup rate, engagement depth | L1+ |
| **MONETIZE** | Middle-bottom | pricing interaction, payment intent, conversion | L2+ |
| **RETAIN** | Bottom | return visits, repeat usage, churn | L3+ |

**Scoring:** Each dimension produces a ratio = actual ÷ threshold (from hypothesis). A ratio of 1.0 means "exactly met threshold." No 0-100 normalization — the raw ratio preserves signal magnitude.

**Confidence** per dimension based on sample size:
- <30 events → `insufficient` (ratio shown but grayed out)
- 30-100 → `directional`
- 100-500 → `reliable`
- 500+ → `high`

**Decision logic:** Walk the funnel top-down. The first dimension below threshold is the **bottleneck**. Decision is based on bottleneck severity, not an average:

| Condition | Decision | Meaning |
|-----------|----------|---------|
| All tested dimensions ≥ 1.0 | SCALE | Funnel is healthy — invest more |
| Bottleneck ratio ≥ 0.7 | REFINE | Close to threshold — address bottleneck dimension |
| Bottleneck ratio < 0.7 | PIVOT | Significant gap — change the angle, keep the problem space |
| Top-funnel (REACH or DEMAND) < 0.5 | KILL | No signal at the top — stop spending, archive |

The bottleneck is highlighted with a specific recommendation (e.g., "Bottleneck: DEMAND (ratio 0.65). Signup rate 3.2% vs 5.0% threshold. Consider stronger CTA or social proof.").

---

## 4. API & Data Flow

### API Routes

```
GET    /api/experiments                            — list experiments (paginated: ?page=1&limit=20)
GET    /api/experiments/:id                        — get single experiment
POST   /api/experiments                            — create experiment
PATCH  /api/experiments/:id                        — update status, deployed_url, decision
DELETE /api/experiments/:id                         — soft delete (sets archived_at)

POST   /api/experiments/:id/hypotheses             — store hypotheses (from /spec), mode: append|replace
GET    /api/experiments/:id/hypotheses              — list (paginated)

POST   /api/experiments/:id/offers                 — store offer variants (from /offer), mode: append|replace
GET    /api/experiments/:id/offers                  — list (paginated)

POST   /api/experiments/:id/insights               — store scorecard + decision (from /iterate)
GET    /api/experiments/:id/insights                — list decision history (paginated)

POST   /api/experiments/:id/research               — store research results (from /spec)
GET    /api/experiments/:id/research                — list (paginated)

POST   /api/experiments/:id/metrics/sync           — query PostHog, cache in experiment_metrics
GET    /api/experiments/:id/metrics                 — get cached metrics

POST   /api/experiments/:id/spec                    — calls Claude AI, returns full spec (NOT persisted)
```

All list endpoints support `?page=1&limit=20` pagination (default limit: 20, max: 100).

Sub-resource POST endpoints accept `mode` parameter: `append` (default) adds rows, `replace` deletes existing rows for the experiment then inserts.

### Error Response Schema

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable description",
    "details": {}
  }
}
```

Error codes: `validation_error`, `not_found`, `unauthorized`, `rate_limited`, `ai_error`, `internal_error`.

### Data Flow

```
/spec → returns experiment.yaml (hypotheses + behaviors + variants + funnel + stack)
     ↓
User reviews/edits experiment.yaml
  → POST /api/experiments/[id]/hypotheses (mode: replace)
  → POST /api/experiments/[id]/research (persisted)
  → POST /api/experiments/[id]/offers (persisted)
     ↓
/bootstrap → generates code (filesystem side effect)
     ↓
/deploy → deploys (infrastructure side effect)
  → PATCH /api/experiments/[id] { status: "active", deployed_url: "..." }
     ↓
PostHog ← user behavior events
     ↓
POST /api/experiments/[id]/metrics/sync → queries PostHog → caches in DB
     ↓
/iterate → returns scorecard + per-hypothesis verdicts
  → POST /api/experiments/[id]/insights (persisted)
  → PATCH hypotheses SET status = 'passed'/'failed' (per-hypothesis)
```

### Metrics Sync Caching

`POST /api/experiments/:id/metrics/sync` queries PostHog only if `fetched_at` is older than 15 minutes. Within 15 minutes, returns cached data. Manual refresh via `?force=true` bypasses the cache.

### Env Vars

```
ASSAYER_API_URL=https://assayer.io    # or http://localhost:3000 in dev
ASSAYER_API_KEY=<service-key>         # skill-to-API auth
```

---

## 5. Data Model

```sql
-- Experiments
CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  idea_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  experiment_level integer CHECK (experiment_level IN (1, 2, 3)),  -- L1 Pitch, L2 Prototype, L3 Product
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

-- Hypothesis dependencies (replaces depends_on uuid[])
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

-- Variants (offer variants)
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
  reach_ratio numeric,                    -- actual ÷ threshold
  reach_confidence text,                  -- 'insufficient', 'directional', 'reliable', 'high'
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
  bottleneck_dimension text,              -- first funnel dimension below threshold
  bottleneck_recommendation text,         -- actionable suggestion
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

### Experiment Status Transitions

```
draft → active → paused → active (resume)
                → completed → archived
                → archived (kill)
draft → archived (abandon)
```

Transitions are triggered by skill invocations:
- `draft → active`: `/deploy` succeeds
- `active → paused`: user action
- `active → completed`: `/iterate` returns SCALE or KILL
- `* → archived`: `/teardown` or user action

### Hypothesis Status Transitions

```
pending → testing → passed
                  → failed
                  → skipped
```

- `pending → testing`: experiment status becomes `active`
- `testing → passed/failed`: `/iterate` produces verdict
- `* → skipped`: user manually skips

### Pages

```yaml
pages:
  - name: landing        # Assayer product intro + signup
  - name: dashboard      # Experiment overview + portfolio
  - name: new-experiment # Create wizard (idea + level → spec → deploy)
  - name: experiment     # Detail (tabs: overview, hypotheses, variants, data, insights)
  - name: settings       # Account, billing
```

### Validation Asset Types

| Level | Name | Tests | Stack Needed | Includes |
|-------|------|-------|-------------|----------|
| L1 | **Pitch** | Is there interest? (REACH + DEMAND) | Vercel + PostHog + shadcn | — |
| L2 | **Prototype** | Will they engage? (+ MONETIZE) | + Supabase | Everything from L1 |
| L3 | **Product** | Will they use and retain? (+ RETAIN) | Full template stack (+ Auth) | Everything from L1 + L2 |

---

## 6. Build Order

Each step = one Claude Code session unless noted. Sessions are self-contained — they read the codebase, not the previous session's context.

| # | What | Where | Method | Depends On | Est. |
|---|------|-------|--------|-----------|------|
| 0 | Infrastructure setup (Supabase, OAuth apps, PostHog, domain, Vercel, Sentry, CI/CD) | Infra | manual | — | Day 0 |
| 0.5 | Global rename `idea.yaml` → `experiment.yaml` (66 files) | mvp-template | direct edit | — | 2-3 hrs |
| 1 | Create `spec.md` (idea + level → experiment.yaml with hypotheses, behaviors, variants) | mvp-template | direct file creation | #0.5 | 10-14 hrs |
| 2 | Enhance `iterate.md` (per-hypothesis verdicts + proxy quality) | mvp-template | direct edit | — | 3-5 hrs |
| 3 | Minor updates to `distribute.md` | mvp-template | direct edit | #1 output format | 1-2 hrs |
| 4 | Update Assayer `idea.yaml` (new API routes, new tables, new features) | Assayer | manual edit | #1-2 define data structures | 1-2 hrs |
| 5 | `/bootstrap` Assayer platform | Assayer | /bootstrap | #4 | 1-2 hrs |
| 6 | `/change`: error response schema + API key auth middleware | Assayer | /change | #5 | 2-3 hrs |
| 7 | `/change`: experiments + hypotheses + clusters CRUD | Assayer | /change | #6 | 3-4 hrs |
| 8 | `/change`: research + offers + metrics CRUD + AI spec endpoint | Assayer | /change | #6 | 3-4 hrs |
| 9 | `/change`: new experiment page (AI generation + level selection + inline editing) | Assayer | /change | #7-8 | 3-5 hrs |
| 10 | `/change`: dashboard + experiment detail pages (all tabs) | Assayer | /change | #7-8 | 4-6 hrs |
| 11 | `/change`: PostHog metrics sync endpoint (with 15min cache) | Assayer | /change | #7 | 4-6 hrs |
| 12 | `/harden` + `/verify` | Assayer | /harden, /verify | #9-11 | 2-4 hrs |
| 13 | `/deploy` | Assayer | /deploy | #12 | 1-2 hrs |
| 14 | Run first real experiment using the platform | Both repos | manual | #13 | — |

**Estimated total: 45-60 hrs** (excludes infra setup and step 14).

**Session types:**
- **direct file creation** (step 1): Write new `.claude/commands/spec.md`. No skill involved — this IS the skill being created.
- **direct edit** (steps 0.5, 2-3): Modify existing files. Mechanical or focused changes.
- **manual edit** (step 4): Update `idea.yaml` by hand to reflect new features/routes/tables.
- **/bootstrap** (step 5): Standard skill — generates scaffold from experiment.yaml.
- **/change** (steps 6-11): Standard skill — updates idea.yaml feature, then implements. One bounded feature per session.

**Parallelism:** #2, #3 can run in parallel with #1. #7 and #8 can run in parallel (both depend only on #6). #9, #10, #11 can run in parallel.

### Skill-to-Skill Data Flow

Skills pass data via manifest files (same pattern as `/iterate` writing `.claude/iterate-manifest.json`):

```
/spec        → writes idea/experiment.yaml
             → writes .claude/spec-manifest.json (intermediate data for /iterate)
                  ↓
/bootstrap   → reads idea/experiment.yaml
                  ↓
/iterate     → reads .claude/spec-manifest.json (for per-hypothesis verdicts)
             → writes .claude/iterate-manifest.json
```

Manifest files are committed to the experiment repo so they persist across sessions and workspaces.

### Infrastructure (Day 0 — before all other work)

| What | Est. |
|------|------|
| Create Supabase project (platform DB + Auth) | 30 min |
| Register Google OAuth app + GitHub OAuth app (for Supabase Auth) | 30 min |
| Create PostHog project (shared for platform + experiments) | 15 min |
| Create Stripe account + test products | 30 min |
| Purchase/configure assayer.io domain + wildcard DNS + SSL → Vercel | 1 hr |
| Set up Vercel Pro account | 15 min |
| Set up Sentry (Next.js integration) | 30 min |
| Set up GitHub Actions CI (build + lint + test) | 30 min |

### Future Additions (build when triggered)

| Feature | Trigger |
|---------|---------|
| `/assay` orchestrator | Users ask for "one command" automation |
| Auto-sequencing | 20+ experiments in DB |
| Benchmark database | 100+ experiments in DB |
| Google/Meta Ads API write | Manual campaign creation becomes bottleneck |
| Agent SDK on Cloud Run + Workspace Lifecycle (Agent SDK path) | External users arrive |
| Upstash rate limiting | External API exposure |
| Pricing tiers + Stripe activation | ai_usage data available + external users |
| Experiment comparison view | 5+ experiments per user |
| PostHog project sharding | 100+ experiments, query perf degrades |

---

## 7. Implementation Constraints

- Use Opus for all AI skills (`/spec`, `/iterate`). Quality over cost — every skill output directly impacts user decisions.
- Token budget tracked in `ai_usage` table from Day 1 with two categories:
  - **Analysis** (`/spec`, `/iterate`): $5 per-experiment cap
  - **Implementation** (`/bootstrap`, `/change`): tracked but uncapped (cost varies by experiment complexity)
- Every AI-calling skill must: validate output with zod, retry once on parse failure, return typed error on second failure.
- Show sample size alongside every metric. Never auto-decide with <100 clicks.
- Allow user to preview and edit AI-generated content before deployment.
- Rate limit AI-calling API endpoints (`/api/experiments/:id/spec`) from Day 1 — application-level, in-memory counter.

---

## 8. UX Reference

### CLI — After /spec

```
/spec "AI-powered invoice tool for freelancers"

Pre-flight checks                                    4/4 passed
──────────────────
✓ Market exists        Freelancer invoicing: $4.2B TAM          (confidence: high)
✓ Problem validated    340+ forum threads                       (confidence: high)
✓ Competitors found    None use AI generation                   (confidence: medium)
✓ ICP identifiable     Solo freelancers, US/EU                  (confidence: high)

Level: L1 Pitch (default)
Build: $150  Ad budget: $200  Time: 7 days

Hypotheses:
  REACH      "Ad CTR > 2% for freelancer invoice keywords"  → CTR
  DEMAND     "Freelancers search for invoice automation"     → signup rate
  MONETIZE   "Freelancers will pay $19/mo"                   → pricing clicks

Behaviors (3):
  b-01  Given a freelancer lands → they understand the value prop      (L1)
  b-02  Given interest → CTA click enters signup flow                  (L1)
  b-03  Given pricing shown → they interact with pricing options       (L1)

Variants (3):
  "time-saver"    Save 5 Hours Every Week on Invoicing
  "ai-magic"      Your AI Invoicing Assistant
  "cost-cutter"   Cut Invoicing Costs by 80%

Wrote idea/experiment.yaml
Run /bootstrap to scaffold, or edit experiment.yaml first to adjust.
To test at L2/L3, run: /spec "AI-powered invoice tool" --level 2
```

### CLI — After /iterate

```
RESULTS — Experiment #1 (L1 Pitch)
═══════════════════════════════════════════════

Funnel scorecard:
  REACH      1.90  ██████████████████░░  CTR 3.8% / 2.0%         (reliable — 523 impressions)
  DEMAND     1.34  ████████████████░░░░  6.7% signup / 5.0%      (reliable — 523 visitors)
  MONETIZE   0.65  █████████████░░░░░░░  4.5% clicks / 7.0%      (directional — 89 clicks)
  RETAIN     --    (not tested — requires L3)

⚠ Bottleneck: MONETIZE (ratio 0.65). Pricing click rate 4.5% vs 7.0% threshold.
  Consider: test lower price points or add value justification.

Hypothesis verdicts:
  REACH      CTR 3.8% vs 2.0% threshold     PASS ✓  (reliable — 523 impressions)
  DEMAND     6.7% signup vs 5.0%             PASS ✓  (reliable — 523 visitors)
  MONETIZE   4.5% pricing clicks vs 7.0%     FAIL ✗  (directional — 89 clicks)

VERDICT: REFINE (bottleneck MONETIZE at 0.65)
Recommended: Adjust pricing/value prop, then upgrade to L2 for deeper engagement data
```

### Web UI — New Experiment (2-Step Wizard)

```
Step 1 — Describe:

┌────────────────────────────────────────────────────────────┐
│  Your idea: "AI-powered invoice tool for freelancers"      │
│                                                            │
│  Or try an example:                                        │
│  [AI resume builder] [Meal prep planner] [SaaS analytics]  │
│                                                            │
│  Level: [L1 Pitch ▾]  [L2 Prototype]  [L3 Product]        │
│                                                            │
│  [Generate Spec]                                           │
└────────────────────────────────────────────────────────────┘

Step 2 — Review & Create:

┌────────────────────────────────────────────────────────────┐
│  ai-invoice-tool — L1 Pitch                                │
│  Build: $150  Ad budget: $200  Time: 7 days                │
│                                                            │
│  Pre-flight checks:                        4/4 passed      │
│  ✓ Market  ✓ Problem  ✓ Competition  ✓ ICP                 │
│                                                            │
│  Hypotheses (3):                                           │
│  ┌ REACH     "Ad CTR > 2%"              → CTR            ┐│
│  │ DEMAND    "Signup rate > 5%"          → signups        ││
│  └ MONETIZE  "Pricing clicks > 7%"      → clicks         ┘│
│                                                            │
│  Behaviors (3):                                            │
│  b-01  Given landing → understand value prop      (L1)     │
│  b-02  Given interest → CTA enters signup         (L1)     │
│  b-03  Given pricing → interact with options      (L1)     │
│                                                            │
│  Variants (3):                                             │
│  "time-saver" | "ai-magic" | "cost-cutter"                 │
│                                                            │
│  All AI-generated fields are editable — click any value    │
│  to modify. [Regenerate]                                   │
│                                                            │
│  [Create Experiment]                                       │
└────────────────────────────────────────────────────────────┘

Single API call: POST /api/experiments/:id/spec
```

### Web UI — Monitoring

```
┌────────────────────────────────────────────────────────────┐
│  AI Invoice Tool          ACTIVE   Day 3/7   L1 Pitch      │
│                                                            │
│  Impressions: 2,340  Clicks: 89  Spend: $62                │
│                                                            │
│  REACH     CTR 3.8% / 2.0%  ████████████████ 1.90  ✓ PASS │
│  DEMAND    6.7% signup / 5.0% ██████████████░ 1.34  ✓ PASS │
│  MONETIZE  4.5% clicks / 7.0% █████████░░░░░ 0.65  ⚠ LOW  │
│  RETAIN    — (requires L3)                                 │
│                                                            │
│  [Pause]  [View Site]  [Analyze Early]  [Upgrade to L2]    │
└────────────────────────────────────────────────────────────┘
```
