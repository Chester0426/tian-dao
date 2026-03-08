# Assayer — Product Design Document

> **Assayer**: an AI-powered demand validation platform that helps founders answer "Is this idea worth building?" by running real-world experiments with real traffic and real user behavior.
>
> **Name etymology**: An assayer tests the quality of gold ore before deciding whether to mine. "Know if it's gold before you dig."
>
> **Domain**: assayer.io

---

## Table of Contents

1. [Why This Exists](#1-why-this-exists)
2. [Who It's For](#2-who-its-for)
3. [Architecture](#3-architecture)
4. [Skill Lifecycle](#4-skill-lifecycle)
5. [State Persistence](#5-state-persistence)
6. [Technology Stack](#6-technology-stack)
7. [Development Strategy](#7-development-strategy)
8. [Execution Plan](#8-execution-plan)
9. [Template Enhancement: Production Quality Mode](#9-template-enhancement-production-quality-mode)
10. [Data Model](#appendix-data-model)

---

## 1. Why This Exists

**Core Loop** — every link must be supported; missing one breaks validation:

```
Idea → Hypothesis → Offer → Asset → Traffic → Behavior → Insight → Decision
  ^                                                                        |
  +---------------------------- Next Experiment <--------------------------+
```

**Market gap**: Many tools do pieces (idea scoring, MVP building, ad optimization). No platform closes the full loop from idea → real traffic → real behavior → AI-driven kill/pivot/scale decision.

**Meta-product advantage**: Assayer uses the mvp-template to build itself AND to generate validation assets for users. Each experiment is an independent template-generated project (landing page, fake door, or functional demo) deployed at `exp-name.assayer.io`.

---

## 2. Who It's For

**Primary**: Serial founders, indie hackers, AI builders, small teams (2-20). High experiment frequency, understand validation, fear wrong direction.

**Secondary**: Agencies, startup studios, venture builders, early-stage product teams.

**Core JTBD**: "Help me, before committing significant dev and marketing budget, quickly determine whether an idea is worth continuing."

---

## 3. Architecture

### Everything is a Skill

All AI capabilities are Claude Code skill files (`.claude/commands/*.md`). Two execution paths, zero divergence:

```
                    .claude/commands/*.md
                    (hypothesize, offer, bootstrap, deploy, distribute, iterate, ...)
                            |
              +-------------+-------------+
              v                           v
      Internal Team               External Users
      (Claude Code CLI)           (Agent SDK on Cloud Run)
              |                           |
         claude "/iterate"          query("/iterate")
              |                           |
              +------ Same skill ---------+
                   Same output quality
```

Internal team uses Claude Code (subscription). External users go through Agent SDK (API tokens, compliant for products).

### Agent SDK Integration

```typescript
import { Claude } from "@anthropic-ai/claude-code";

const claude = new Claude({ cwd: workspacePath });
const result = await claude.sendMessage("/bootstrap", {
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
});
```

> **Note:** API shape is illustrative — verify against latest [Claude Code SDK docs](https://docs.anthropic.com/en/docs/claude-code) before implementation.

Execution environment: Docker image on Google Cloud Run Jobs (Node.js 20+, npm, git, gh, vercel CLI, supabase CLI, Agent SDK, template files pre-loaded). Scale-to-zero, 5-15min task timeout.

### Authentication

| Method | Provider | Notes |
|--------|----------|-------|
| Email + password | Supabase Auth | TOTP 2FA required |
| Google OAuth login | Supabase Auth | `openid email profile` scope |
| GitHub OAuth login | Supabase Auth | Standard |

**Critical distinction**: Login OAuth (Supabase Auth) is independent from API OAuth (Google/Meta Ads account connection). API tokens stored encrypted in `oauth_tokens` table via Supabase Vault.

### Hosting Model

```
Assayer Platform  →  Vercel (assayer.io) + Supabase
Experiment A      →  Vercel (exp-a.assayer.io), no DB (landing page)
Experiment B      →  Vercel (exp-b.assayer.io) + Supabase (signup flow)
Experiment C      →  Vercel (exp-c.assayer.io) + Supabase (functional demo)
```

All experiments share one PostHog project. Template `global_properties` distinguishes events by experiment.

---

## 4. Skill Lifecycle

### 9 Experiment Skills

| # | Skill | State Transition | Status |
|---|-------|-----------------|--------|
| 1 | `/hypothesize` | Idea → Testable hypotheses + priority ranking | **New** |
| 2 | `/offer` | Hypotheses → 3-5 value proposition variants | **New** |
| 3 | `/bootstrap` | idea.yaml → Project code | Existing |
| 4 | `/change` | Modify experiment code (pivot) | Existing |
| 5 | `/verify` | Build + test quality gate | Existing |
| 6 | `/deploy` | Code → Live URL | Existing |
| 7 | `/distribute` | Live → Traffic (ad copy, UTM, channel rec, budget) | **Enhanced** |
| 8 | `/iterate` | Traffic data → Insights + scorecard + decision | **Enhanced** |
| 9 | `/teardown` | Remove infrastructure + archive | **Enhanced** |

### Flow

```
/hypothesize → /offer → /bootstrap → /verify → /deploy → /distribute
                                                              |
                                                         traffic flows
                                                              |
                                                          /iterate
                                                         /    |    \
                                                      SCALE PIVOT  KILL
                                                        |     |      |
                                                   graduate  /offer  /teardown
                                                            /change
                                                           /distribute
```

### Validation Scorecard (produced by /iterate)

Five dimensions, 0-100 each:

1. **Attention** — ad CTR + time on page
2. **Intent** — CTA click rate + signup rate
3. **Trust** — return visits + deep browsing
4. **WTP** — pricing page interaction + payment intent
5. **Retention** — return visits + repeat behavior

Decision matrix: >70 SCALE, 40-70 REFINE, 20-40 PIVOT, <20 KILL.

### Benchmark Data (Data Moat)

Every `/iterate` persist automatically writes anonymized metrics (industry, channel, CTR, CPA, scores — no user identity or idea text) to a cross-user `benchmarks` table. Skills query this to enhance output:

- `/hypothesize`: "ICP validation has 60% success rate vs 30% for pricing — prioritize ICP"
- `/distribute`: "Dev tools: Google CPC averages $2.30, Meta CPA $8.50 — allocate accordingly"
- `/iterate`: "Your 4.1% signup rate is top 25% for B2B SaaS landing pages"

---

## 5. State Persistence

### The Problem

Agent SDK runners are ephemeral (Docker containers). Skill output (hypotheses, offers, insights, decisions) must survive container shutdown.

### Solution: Skills Call Assayer Platform API

```
              Assayer Platform API (Vercel, always running)
              POST /api/experiments/:id/hypotheses
              POST /api/experiments/:id/offers
              POST /api/experiments/:id/insights
                     ^              ^
                     |              |
         Claude Code (internal)   Agent SDK (external)
         same API, same DB        same API, same DB
```

Skills use HTTP calls (simpler than raw SQL from .md files). API handles auth, validation, RLS. Both paths behave identically.

### API Routes

```
POST   /api/experiments                          — create experiment
PATCH  /api/experiments/:id                      — update status, deployed_url, decision
DELETE /api/experiments/:id                       — archive

POST   /api/experiments/:id/hypotheses           — store hypotheses
POST   /api/experiments/:id/offers               — store offer variants
POST   /api/experiments/:id/assets               — store asset metadata
POST   /api/experiments/:id/campaigns            — store ad campaign links
POST   /api/experiments/:id/insights             — store analysis + scorecard + decision

GET    /api/experiments/:id                      — read experiment context
GET    /api/experiments/:id/hypotheses            — /offer reads /hypothesize output
GET    /api/experiments/:id/offers                — /distribute reads offers for ad copy
GET    /api/experiments/:id/insights              — /iterate builds on previous analyses
```

### Env Vars

```
ASSAYER_API_URL=https://assayer.io    # or http://localhost:3000 in dev
ASSAYER_API_KEY=<service-key>         # skill-to-API auth
```

Every skill with operational output MUST include a `## Persist` section. If API call fails, retry once, then surface error with raw JSON so nothing is lost.

---

## 6. Technology Stack

### Core Principle: Template Consistency

Platform stack matches template stack — one framework, one mental model, one set of debugging skills.

### Layer 1: Core Platform

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js (App Router) | Template consistency |
| Hosting | Vercel Pro | Native Next.js, CDN, Cron (40 jobs) |
| Database | Supabase (Postgres) | RLS + Auth integration, Realtime, Vault |
| Auth | Supabase Auth | RLS zero-middleware, OAuth, TOTP 2FA |
| Analytics | PostHog | UTM auto-capture, funnel analysis, 1M events/mo free |
| UI | shadcn/ui | Source-level customization, built-in charts (Recharts) |
| Payment | Stripe | PCI handled by Elements |

### Layer 2: Assayer-Specific

| Category | Choice | Packages |
|----------|--------|----------|
| AI Model | Claude (Sonnet 4.6 daily, Opus 4.6 decisions) | `@anthropic-ai/sdk` |
| AI Streaming | Vercel AI SDK | `ai`, `@ai-sdk/anthropic` |
| Agent Runtime | Google Cloud Run Jobs | Docker image |
| Error Monitoring | Sentry | `@sentry/nextjs` |
| Data Fetching | TanStack Query | `@tanstack/react-query` |
| Rate Limiting | Upstash | `@upstash/ratelimit` |
| Forms | React Hook Form + Zod | `react-hook-form` |
| State | Zustand | `zustand` |

### Layer 3: Phased (Not V1)

| Choice | Trigger | Phase |
|--------|---------|-------|
| Google Ads API (read) | First experiment with paid ads | V1.5 |
| Meta Marketing API (read) | Same | V1.5 |
| Resend | Waitlist confirmation needed | V1.5 |
| Inngest | >10 cron jobs | P2 |
| Langfuse | >1000 AI calls/month | P2 |
| Cloudflare WAF | Attack signals detected | P2 |

### Explicitly Rejected

| What | Why Not |
|------|---------|
| AI Gateway (LiteLLM/Portkey) | Single model — routing value is zero |
| Vector Store | Benchmarks are structured SQL data |
| Multi-model fallback | Agent SDK binds to Claude |
| Datadog/Grafana | Serverless; Vercel+Supabase dashboards suffice |
| Kubernetes | <100 concurrent runners |
| Segment CDP | Short-lifecycle experiments don't need cross-platform identity |
| SOC 2 | $20K+ before revenue validation is premature |

### Required New Stack Files

| File | Purpose | Priority |
|------|---------|----------|
| `stacks/ai/anthropic.md` | Claude SDK + Vercel AI SDK patterns | P0 |
| `stacks/ads/google.md` | Google Ads API integration | P1 |
| `stacks/ads/meta.md` | Meta Marketing API integration | P1 |

### idea.yaml Stack

```yaml
stack:
  framework: nextjs
  hosting: vercel
  database: supabase
  auth: supabase
  analytics: posthog
  ui: shadcn
  payment: stripe
  email: resend          # V1.5
  testing: playwright
  ai: anthropic          # Claude SDK + Vercel AI SDK
  ads-google: google     # V1.5
  ads-meta: meta         # V1.5
```

---

## 7. Development Strategy

Assayer is a production product, not a throwaway experiment. Standard MVP quality (Rule 4: smoke tests only) creates unsustainable debt.

### `quality: production` in idea.yaml

When present, activates production development rules extracted from [Superpowers](https://github.com/obra/superpowers) patterns:

| Pattern | File | What It Does |
|---------|------|-------------|
| TDD | `patterns/tdd.md` | RED-GREEN-REFACTOR, no production code without failing test |
| Subagent Development | `agents/implementer.md` + `agents/spec-reviewer.md` | Fresh subagent per task, spec review |
| Systematic Debugging | `patterns/systematic-debugging.md` | 4-phase root cause process |

### Production Workflow

```
Feature request
  → /change updates idea.yaml
  → Design doc (docs/plans/YYYY-MM-DD-<feature>-design.md)
  → Implementation plan (bite-sized tasks)
  → Per-task: implementer subagent → TDD (red/green/refactor) → spec review → quality review
  → /verify (build + E2E gate)
  → PR via gh pr create
```

When `quality` is absent (default): standard MVP behavior — smoke tests, fast iteration.

---

## 8. Execution Plan

### Phase 1: Internal Team Tool

| Step | What | Type |
|------|------|------|
| 0 | Production quality patterns + agents (tdd.md, implementer.md, etc.) | Template |
| 1 | `stacks/ai/anthropic.md` | Template |
| 2 | `stacks/ads/google.md` | Template |
| 3 | `stacks/ads/meta.md` | Template |
| 4 | Write Assayer idea.yaml (`quality: production`) | Product |
| 5 | Run /bootstrap → complete Assayer V1 (pages, API, DB, auth, analytics) | Product |
| 5.5 | TDD harden critical paths (auth, payment, persist API, OAuth tokens) | Product |
| 6 | Write new skills (hypothesize, offer) with `## Persist` sections | Product |
| 7 | Deploy (Vercel Pro) | Product |

### Phase 1.5: Ad Data Integration

Trigger: first experiment goes live with paid ads.

- Google Ads API (read), Meta Marketing API (read)
- Resend (waitlist emails), cookie consent banner
- Cron jobs (sync-ads, auto-analyze, budget-monitor)

### Phase 2: External Users (1-2 months)

- Agent SDK integration + Docker execution environment (Cloud Run)
- Experiment workspace manager
- Dashboard UI (reads from persist API)

### Phase 3: Scale (3+ months)

- Concurrent bootstrap (multiple Cloud Run sandboxes)
- Full Google/Meta Ads API write (auto-create campaigns)
- AI-driven budget optimization, benchmark enrichment
- Cloudflare WAF, Amazon seller vertical

### Cost Projection

| Phase | Monthly | Breakdown |
|-------|---------|-----------|
| 1 | ~$20 | Vercel Pro |
| 1.5 | ~$20 | Same (free tiers) |
| 2 | ~$75-115 | Vercel $20 + Cloud Run ~$10-50 + Sentry $26 + Supabase Pro $25 |
| 3 | ~$200-500 | + Inngest $25 + Langfuse + Cloudflare $20 + more Cloud Run |

Per-experiment AI cost: ~$1-5 (varies by model and task complexity — verify current pricing at anthropic.com/pricing).

---

## 9. Template Enhancement: Production Quality Mode

Assayer itself is production code, not a throwaway MVP. The mvp-template must support both modes in a single repo via a `quality` field in idea.yaml.

### Why One Repo, Not Two

Two repos (mvp-template + production-template) means ~70 duplicated files (stacks, skills, agents, patterns). Every bug fix = two PRs. And crucially, upgrading a successful MVP to production requires migrating to a different template — a wall instead of a ramp.

One repo with `quality: production` means: add one field to idea.yaml, everything changes. Same `/change`, same `/verify`, internal behavior adapts.

### Why NOT Superpowers for MVPs

| | Without Superpowers | With Superpowers |
|-|--------------------|--------------------|
| Planning | 0 min (idea.yaml is the spec) | 30-60 min (design doc + plan) |
| Implementation | 30-60 min (scaffold) | 2-4 hrs (TDD per task) |
| Verification | 10 min (/verify) | 30 min (/verify + reviews) |
| **Total** | **~1 hour** | **~4-6 hours** |

5-6x slowdown for code with 90% chance of deletion. Assayer's core value is speed of validation — TDD on a landing page is anti-value.

### Gap Analysis: Our Template vs Superpowers

| Dimension | Our Template | Superpowers |
|-----------|-------------|-------------|
| Implementation quality (TDD, per-task review) | Weak — no TDD, no per-task review | Strong |
| Verification quality (final checks) | Strong — 5-agent parallel review, security, UX, visual | Weak — only code review |
| Planning granularity | Medium — high-level plan | Strong — 2-5 min TDD tasks |
| Debugging protocol | None | Strong — 4-phase root cause |
| Security review | Strong — defender + attacker + fixer | None |
| Visual review | Strong — screenshot + design-critic | None |
| UX flow review | Strong — ux-journeyer + golden path | None |

**The two systems are complementary, not overlapping.** Production quality mode injects Superpowers' process quality before our verification quality.

### Integration Architecture

Extracted 4 capabilities from [Superpowers](https://github.com/obra/superpowers), embedded in existing entry points (`/change` and `/verify`). No new skills to learn, no new commands.

```
Superpowers source              →  Integrated as
─────────────────────────────────────────────────
test-driven-development/SKILL   →  patterns/tdd.md
systematic-debugging/SKILL      →  patterns/systematic-debugging.md
implementer-prompt.md           →  agents/implementer.md
spec-reviewer-prompt.md         →  agents/spec-reviewer.md

Discarded (already have equivalents):
brainstorming                   →  idea.yaml + /change plan phase
writing-plans                   →  absorbed into /change Step 6
executing-plans / SDD           →  absorbed into /change Step 6
implementation-planning         →  absorbed into /change Step 6
git-worktrees                   →  Agent tool isolation: "worktree"
verification-before-completion  →  verify.md "Prove it" section
finishing-branch                →  branch.md + PR template
quality-reviewer                →  design-critic + security-* agents
```

### File Changes

**Files created:**

| File | Purpose | Consumed by |
|------|---------|-------------|
| `patterns/tdd.md` | TDD + specification testing discipline | implementer agent |
| `patterns/systematic-debugging.md` | 4-phase root cause analysis (NOT quality-gated — useful always) | any debugging situation |
| `agents/implementer.md` | TDD-aware subagent, fresh context per task | /change spawns it |
| `agents/spec-reviewer.md` | Checks "did you build what was specified?" | /verify spawns it |
| `commands/harden.md` | MVP → Production transition (closed-loop) | user invokes directly |

**Files modified:**

| File | Change |
|------|--------|
| `CLAUDE.md` Rule 4 | Added `quality: production` conditional (TDD required for business logic) |
| `commands/change.md` | Step 4: precondition (quality: production requires stack.testing). Step 6: production path for Feature, Fix, AND Upgrade types. Task dependency ordering for implementer. |
| `commands/bootstrap.md` | scaffold-\* generate tests alongside code when production; hardening guidance; agent test ownership |
| `patterns/verify.md` | spec-reviewer as 6th parallel agent when production |
| `idea/idea.yaml` | Optional `quality` field |
| `commands/iterate.md` | Graduation recommendation when verdict=GO (suggest /harden) |

### How /change Works in Production Mode

```
/change "Add persist API for experiments" (quality: production)

Phase 1: Plan → Approve (same as today, but plan notes "N TDD tasks")

Phase 2:
  Step 4: Precondition — verify stack.testing is present.
          If absent: "Production quality requires a testing framework.
          Add testing: playwright (web-app) or testing: vitest (service/cli)."

  Step 5: Update idea.yaml (same)

  Step 6: Production quality path (Feature, Fix, AND Upgrade types)
    1. Generate implementation plan — break into 2-5 min TDD tasks
       Each task: exact files, failing test code, expected failure, minimal impl
    2. Analyze task dependency graph:
       - Independent tasks → spawn implementer agents in parallel
       - Dependent tasks (B imports from A) → sequential execution
       Tell user: "N tasks, M parallel / K sequential"
    3. For each task:
       → Spawn implementer agent (fresh context, worktree isolation)
       → Implementer: write specification test (what code SHOULD do)
                      → verify fails (RED) → write minimal code (GREEN)
                      → verify passes → refactor → self-review → commit
    4. Merge worktree changes, continue to Step 7

  Step 7: Verify (6 agents: existing 5 + spec-reviewer)
  Step 8: PR (keep .claude/current-plan.md until after Step 7)
```

**Specification tests, not characterization tests.** Write tests that define what the code *should* do, not what it *currently* does. If the code fails the specification test, that's a real bug to fix — not behavior to lock in.

**Type coverage:** Production TDD path applies to Feature (new code), Fix (bug → regression test), AND Upgrade (Fake Door → real integration). Upgrade is arguably the most security-critical — it handles external credentials, webhooks, and payment lifecycles.

For Polish, Analytics, and smoke-test-only Test changes: standard path (no TDD overhead).

### How /bootstrap Works in Production Mode

TDD is impossible for bootstrap (generating 50 files from scratch — no framework to test against). Instead:

1. scaffold-\* agents generate **tests alongside code** (not TDD, but coverage from day one):
   - **scaffold-setup**: creates test configuration (playwright.config.ts or vitest.config.ts)
   - **scaffold-libs**: generates unit tests for utility functions (validation, parsing, calculations)
   - **scaffold-pages**: generates page-load smoke tests (per existing template behavior)
   - **scaffold-wire**: runs test discovery checkpoint (`npx playwright test --list` or vitest equivalent)
2. /verify includes **spec-reviewer** (checks all idea.yaml features/pages exist)
3. After bootstrap PR merges, run **`/harden`** to add TDD coverage to critical paths

### How /harden Works (MVP → Production Transition)

`/harden` is a **closed-loop skill** — it scans, plans, executes, and verifies in one session. No manual issue tracking. One command, one PR.

```
/harden

Step 0: Validate preconditions
  - package.json exists (app is bootstrapped)
  - npm run build passes (app works)
  - If quality: production already set AND no $ARGUMENTS:
    "Already in production mode. Use /harden <module> to harden
    a specific module, or /change for new features."

Step 1: Scan & classify
  - Read idea.yaml (features, golden_path, critical_flows, stack)
  - Scan src/ for all modules (API routes, lib/, pages, components)
  - Check existing test coverage (glob **/*.test.*, **/*.spec.*, e2e/**)
  - Classify each module:

    CRITICAL (harden now):
    - Auth/session logic (login, register, token, OAuth)
    - Payment/billing (Stripe webhook, subscription lifecycle)
    - Data mutations (POST/PUT/DELETE API routes with DB writes)
    - golden_path value_moment steps
    - critical_flows steps
    - Non-trivial business logic (calculations, state machines)

    ON-TOUCH (harden when next modified):
    - Read-only API routes (GET)
    - Form validation, data fetching/transformation
    - golden_path non-value-moment steps

    SKIP (no hardening needed):
    - Page components (rendering + layout only)
    - UI components (shadcn/ui)
    - Static content, configuration

    ALREADY COVERED:
    - Modules with existing test files (list them)

Step 2: Present plan
  ## Hardening Plan: [project-name]

  ### Current State
  - Modules: N total, M tested, K untested-critical

  ### Will Harden (Critical, no tests):
  1. [module] — [files] — [why critical] — [N specification tests]
  2. ...

  ### On-Touch (Important, defer):
  - [module] — [reason]

  ### Skip:
  - [module] — [reason: UI-only / already covered]

  ### Changes:
  - idea.yaml: add quality: production
  - idea.yaml: add stack.testing if absent

  > Approve to proceed, or remove modules you don't want hardened.

Step 3: Execute (after approval)
  1. Branch setup (chore/harden-production)
  2. Set quality: production in idea.yaml
  3. Add stack.testing if absent (playwright for web-app, vitest for service/cli)
  4. For each approved Critical module, sequentially:
     a. Spawn implementer agent (worktree isolation)
     b. Implementer writes specification tests:
        - What SHOULD the module do? (read code + idea.yaml features)
        - Write tests for correct behavior (may fail if code has bugs)
        - If test fails: fix the code (this is a feature, not a bug)
        - If test passes: good — specification captured
     c. Run npm run build — if broken, fix before next module
     d. Log: "Module [name]: N tests added, all passing"
  5. Run full verification (verify.md — 6 agents including spec-reviewer)
  6. Commit, push, open PR

Step 4: Post-merge guidance
  "Production quality mode is now active.
  - All future /change Feature, Fix, and Upgrade changes use TDD automatically.
  - On-touch modules will be hardened when you next /change them.
  - Run /verify to confirm all tests pass."
```

**Key design decisions:**

- **Closed-loop, not checklist.** Unlike the original plan (create GitHub issue → user runs N commands), `/harden` auto-executes all hardening in one session. Same pattern as `/review` (scan → fix → validate → loop).
- **Specification tests, not characterization tests.** Tests define what the code *should* do. If current code fails the spec test, that's a real bug to fix during hardening — not behavior to preserve.
- **No new /change type.** Hardening done by `/harden` internally. When users want to harden a single module later, they use `/change "Add TDD tests for [module]"` (classified as Test type, routed through production quality path).
- **Sequential module execution.** Each module is hardened one at a time with build verification between modules. Fail-fast prevents cascading breakage.
- **Bug discovery protocol.** When a specification test reveals a bug in existing code: the implementer agent fixes the code to match the specification. This is the point of hardening — not just adding tests, but ensuring correctness.

### Design Guardrails

Edge cases identified by multi-agent first-principles analysis:

| # | Edge Case | Guardrail |
|---|-----------|-----------|
| 1 | `quality: production` set but `stack.testing` absent | **Precondition check** in change.md Step 4 and bootstrap.md: "Production quality requires testing. Add testing: playwright or testing: vitest." |
| 2 | Worktree task B depends on task A's output | **Dependency graph analysis** before spawning implementers. Sequential execution for dependent tasks, parallel for independent. |
| 3 | Specification test reveals bug in existing code | **Fix the code.** Specification tests define correct behavior. If code fails, that's a real bug — implementer fixes it. |
| 4 | `.claude/current-plan.md` deleted before spec-reviewer runs | **Defer deletion** past verify.md Step 7. Delete in Step 8 after PR is created. |
| 5 | `/harden` run twice — duplicate test generation | **Detect existing tests** in Step 1. Modules with test files → "ALREADY COVERED" category. Skip them. |
| 6 | User sets `quality: production` then removes it (downgrade) | **Existing tests remain and keep running.** Downgrade only changes future /change behavior (no TDD). Tests are an asset, never auto-deleted. |
| 7 | Bootstrap in production mode — which agents generate tests? | **Explicit ownership**: scaffold-setup (config), scaffold-libs (unit tests), scaffold-pages (smoke tests), scaffold-wire (discovery checkpoint). |
| 8 | Upgrade type (Fake Door → real integration) skips TDD | **Upgrade gets TDD path too.** It's the most security-critical change type (external credentials, webhooks, payment). |

### Skill Integration Points

Production quality mode touches 3 skills beyond /change and /verify:

| Skill | Integration | Priority |
|-------|-------------|----------|
| `/iterate` | When verdict = GO: recommend `/harden` as graduation step. "Your metrics indicate product-market fit. Run `/harden` to add TDD coverage before scaling." | P0 — natural handoff |
| `/deploy` | When `quality: production`: add `npm test` to pre-flight checks. All tests must pass before deploy. | P1 — safety gate |
| `/retro` | When `quality: production`: add Q5 "Is this graduating to a sustained product?" to capture transition learnings. | P2 — feedback loop |

### Template Enhancement (Completed)

Production quality mode has been fully implemented across three PRs:

- **PR 1**: `patterns/tdd.md` + `patterns/systematic-debugging.md` — reference docs
- **PR 2**: `agents/implementer.md` + `agents/spec-reviewer.md` — subagent definitions
- **PR 3**: CLAUDE.md + change.md + bootstrap.md + verify.md + idea.yaml + `commands/harden.md` + `commands/iterate.md` — activated all conditional branches

---

## Appendix: Data Model

```sql
experiments (
  id, user_id, name, idea_text, status,
  experiment_type, variable_being_tested,
  budget, budget_spent, started_at, ended_at,
  decision, decision_reasoning,
  parent_experiment_id, deployed_url,
  repo_url, vercel_project_id
)

hypotheses (
  id, experiment_id, category, statement,
  test_method, success_metric, threshold,
  estimated_cost, priority_score, result
)

variants (
  id, experiment_id, slug,
  headline, subheadline, cta,
  pain_points, promise, proof, urgency,
  pricing_amount, pricing_model
)

generated_assets (
  id, experiment_id, variant_id,
  asset_type, content_json, public_url
)

ad_campaigns (
  id, experiment_id, platform,
  external_campaign_id, status, budget, spent,
  impressions, clicks, ctr, cpc, conversions, cpa,
  synced_at
)

feedback_responses (
  id, experiment_id, variant_id,
  respondent_email, response_json, created_at
)

experiment_decisions (
  id, experiment_id, decision, confidence_score,
  attention_score, intent_score, trust_score,
  wtp_score, retention_score,
  reasoning, next_steps, created_at
)

experiment_learnings (
  id, experiment_id, category,
  insight, evidence, created_at
)

benchmarks (
  id, industry_category, experiment_type,
  variable_tested, channel, asset_type,
  impressions, clicks, ctr, cpc, conversions, cpa,
  signup_rate, attention_score, intent_score,
  trust_score, wtp_score, retention_score,
  decision, created_at
)
-- No user_id, no idea_text — fully anonymized

oauth_tokens (
  id, user_id, provider,              -- 'google_ads' | 'meta_ads'
  access_token_encrypted,              -- via Supabase Vault (pgsodium)
  refresh_token_encrypted,
  token_expires_at, scopes,
  account_id, account_name,
  created_at, updated_at
)
-- RLS: user can only access own tokens
-- Distinct from login OAuth — these are API integration tokens

ai_usage (
  id, user_id, experiment_id,
  skill_name, model,
  input_tokens, output_tokens,
  cost_usd, latency_ms, created_at
)
```

### Pages

```yaml
pages:
  - name: landing        # Assayer product intro + signup
  - name: dashboard      # Experiment overview + portfolio
  - name: new-experiment # Create wizard (idea → hypotheses → offer → assets)
  - name: experiment     # Detail (tabs: overview, variants, data, insights, ads)
  - name: experiment-edit
  - name: ads-connect    # Google/Meta OAuth
  - name: insights       # Cross-experiment learnings
  - name: settings       # Account, billing, ad accounts
```

### Validation Asset Types

| Level | Type | Tests | Stack Needed |
|-------|------|-------|-------------|
| 1 | Landing Page | Is there interest? | Vercel + PostHog + shadcn |
| 2 | Fake Door | Is there feature demand? | + Supabase |
| 3 | Concierge MVP | Will they use it? | + Auth |
| 4 | Functional Demo | Will they keep using it? | Full template stack |
