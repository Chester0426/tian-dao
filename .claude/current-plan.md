---
skill: bootstrap
archetype: web-app
branch: feat/bootstrap
stack:
  framework: nextjs
  hosting: vercel
  ui: shadcn
  testing: playwright
  database: supabase
  auth: supabase
  analytics: posthog
  payment: stripe
  ai: anthropic
checkpoint: phase2-setup
context_files:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
  - .claude/archetypes/web-app.md
  - .claude/stacks/framework/nextjs.md
  - .claude/stacks/hosting/vercel.md
  - .claude/stacks/ui/shadcn.md
  - .claude/stacks/testing/playwright.md
  - .claude/stacks/database/supabase.md
  - .claude/stacks/auth/supabase.md
  - .claude/stacks/analytics/posthog.md
  - .claude/stacks/payment/stripe.md
  - .claude/stacks/ai/anthropic.md
---

## What I'll Build

**Pages:**
- Landing Page (/) — variant messaging, CTA to assay
- Assay (/assay) — idea input + AI spec generation + signup gate
- Launch (/launch/[id]) — review spec, approve deployment
- Experiment (/experiment/[id]) — live scorecard with funnel metrics
- Verdict (/verdict/[id]) — SCALE/REFINE/PIVOT/KILL verdict display
- Lab (/lab) — portfolio of all user experiments
- Compare (/compare) — side-by-side experiment comparison
- Settings (/settings) — account, OAuth channels, billing

**Behaviors:**
- b-01/b-02: Landing renders variant messaging + CTA navigates to /assay
- b-03/b-04/b-05: Assay idea input, AI spec stream, signup gate
- b-06/b-07: Launch spec review + deploy
- b-08/b-09: Experiment scorecard + change requests
- b-10/b-11: Verdict + distribution ROI
- b-12/b-13: Lab experiment list + navigation
- b-14: Compare side-by-side metrics
- b-15: Settings account/billing management
- b-16/b-17: API spec stream + claim
- b-18/b-19: Experiments CRUD + sub-resources
- b-20/b-21: Skill execution API
- b-22/b-23: Billing operations
- b-24: Distribution campaigns
- b-25: Stripe webhook
- b-26/b-27/b-28/b-29: Cron jobs

**Variants:**
- verdict-machine — "Know if it's gold before you dig."
- time-saver — "Stop building the wrong thing."
- data-driven — "Data-backed verdicts in days, not months."
- Root `/` renders: verdict-machine

**Database Tables:**
- Bootstrap creates initial migration scaffold
- Session 3 adds the full 17-table schema with RLS

**External Dependencies:**
- Anthropic Claude API — ANTHROPIC_API_KEY — core
- Stripe — STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET — core
- Supabase — managed via stack — core
- PostHog — hardcoded publishable key — no credentials needed

**Analytics Events:**
- visit_landing, cta_click on Landing
- signup_start, signup_complete, spec_generated, activate on Assay
- experiment_created on Launch
- experiment_viewed on Experiment/Compare
- verdict_delivered on Verdict
- lab_viewed on Lab
- change_request_submitted, distribution_launched on Experiment
- pay_start, checkout_started on Settings (requires: payment)
- pay_success, payment_complete on webhook (requires: payment)
- retain_return on Root Layout

**Golden Path:**
| Step | Page | Event |
|------|------|-------|
| 1. Visit landing page | landing | visit_landing |
| 2. Enter idea, click 'Test it' | landing | cta_click |
| 3. Watch AI spec materialize | assay | spec_generated |
| 4. Sign up to save | assay | signup_complete |
| 5. Review build, approve launch | launch | experiment_created |
| 6. Monitor live experiment | experiment | experiment_viewed |
| 7. Receive verdict | verdict | verdict_delivered |
| 8. View all experiments | lab | lab_viewed |
| 9. Compare experiments | compare | experiment_viewed |
| 10. Manage account and billing | settings | activate |
Target: 5 clicks

**System/Cron Behaviors:**
- b-25: system, stripe webhook — Update billing/subscription state
- b-26: cron, 15min — Sync metrics
- b-27: cron, 15min — Detect alerts
- b-28: cron, 1h — Clean anonymous specs
- b-29: cron, daily — Dispatch notifications

**Activation mapping:**
- activate event action value: "spec_generated"

**Tests:**
- Test runner: playwright + vitest co-installed
- Full templates (all assumes met)
- Smoke tests for all 8 pages
- Funnel test: landing → spec generation → login → lab/experiment

**Technical Decisions:**
- Initial migration scaffold; full 17-table schema in Session 3
- REST with withErrorHandler/withAuth, zod validation
- Supabase Auth: email + Google + GitHub OAuth, PKCE, cookies
- "use client" pages with useEffect data fetching
