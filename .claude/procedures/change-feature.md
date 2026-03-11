# /change: Feature Implementation

> Invoked by change.md Step 6 when type is Feature.
> Read the full change skill at `.claude/commands/change.md` for lifecycle context.

## Prerequisites from change.md

- experiment.yaml and EVENTS.yaml have been read (Step 2)
- Change classified as Feature (Step 3)
- Preconditions checked (Step 4)
- Plan approved (Phase 1)
- Specs updated (Step 5)

## Implementation

- If `quality: production` is set in experiment.yaml:
  1. **ON-TOUCH check**: If `experiment/on-touch.yaml` exists, check if any files in the implementation plan are listed as ON-TOUCH. For each match: add a prerequisite TDD task to write specification tests for the existing code in that file BEFORE writing new feature code. Remove the entry from `experiment/on-touch.yaml` after tests are added.
  2. Generate implementation plan — break into 2-5 min TDD tasks (exact files, spec test code, expected failure, minimal impl) per `patterns/tdd.md` § Task Granularity
  3. Analyze task dependency graph per `patterns/tdd.md` § Task Dependency Ordering:
     - Independent tasks → spawn implementer agents in parallel (isolation: "worktree")
     - Dependent tasks (B imports A) → sequential execution
     - Tell user: "N tasks, M parallel / K sequential"
  4. For each task: spawn implementer agent (`agents/implementer.md`, isolation: "worktree") → specification test (RED) → minimal code (GREEN) → refactor → commit
  5. Merge worktree changes. If 2+ implementer agents were spawned: quick consistency scan — check for naming divergence, duplicate utilities (3+ copies per Rule 4), and mixed error handling patterns across modified files. Fix under green tests. Budget: 3 minutes.
  6. Continue to Step 7
- If `quality` is absent or `mvp` (default):
- **MVP Task Breakdown** (Multi-layer features only — skip for Simple):
  Break the implementation into checkpointed steps. Each step ends with a `npm run build` gate.

  1. **Data layer** (if database changes needed):
     - Create migration file, TypeScript types, server-side DB helpers
     - Checkpoint: `npm run build` — types must compile

  2. **API layer** (if new routes needed):
     - Create API route handlers with zod validation
     - Wire to database helpers from step 1
     - Checkpoint: `npm run build` — routes must compile

  3. **UI/Output layer**:
     - web-app: Create page components, wire to API routes
     - service: Wire response formatting, add error responses
     - cli: Create command handlers, wire to lib functions
     - Checkpoint: `npm run build` — full app must compile

  4. **Analytics wiring**:
     - Add tracking calls per EVENTS.yaml
     - Checkpoint: `npm run build` — final verification

  Update `.claude/current-plan.md` after each completed step by marking it done (prefix with `[x]`). This enables session recovery if context is lost mid-implementation.

  For Simple (single-layer) features: implement directly without sub-steps — the existing implementation flow below provides sufficient structure.

  This task breakdown supersedes the Sub-step 6a/6b flow at the end of this file for Multi-layer features.

- If adding `payment` to experiment.yaml `stack`: verify both `stack.auth` and `stack.database` are also present. If `stack.auth` is missing, stop and tell the user: "Payment requires authentication to identify the paying user. Add `auth: supabase` (or another auth provider) to experiment.yaml `stack` first." If `stack.database` is missing, stop and tell the user: "Payment requires a database to record transaction state. Add `database: supabase` (or another database provider) to your experiment.yaml `stack` section."
- If the change requires a stack category whose library files don't exist yet (e.g., `payment: stripe` was just added to experiment.yaml but `src/lib/stripe.ts` is missing): install the packages listed in the stack file's "Packages" section, create the library files from its "Files to Create" section, and add its environment variables to `.env.example` — before proceeding to routes and pages. If any install command fails, stop and show the error — the user must fix the environment issue, then retry the failed install command on this branch (do NOT re-run `/change`).
- If `golden_path` was updated in Step 5 and `e2e/funnel.spec.ts` exists: update the funnel test to match the new golden_path. Read the new/modified page source for selectors. Do not rewrite unaffected test steps.
- If behaviors with `actor: system/cron` were updated in Step 5 and `tests/flows.test.ts` exists: add a new test case for the new system/cron behavior. Read the API route source for the endpoint path and expected behavior. If `tests/flows.test.ts` does not exist and vitest is not installed, install vitest and create the file with the new test case. Do not modify existing test cases.
- Wire analytics: every user action in the new feature must fire a tracked event
- Create new pages following the framework stack file's file structure
- Every new page: follow page conventions from the framework stack file, import tracking functions per the analytics stack file, fire appropriate EVENTS.yaml events

> **STOP** — verify analytics before proceeding. Every new page must fire its events from EVENTS.yaml. Every user action in the new feature must have a tracking call. Do not proceed until confirmed. "I'll add analytics later" is not acceptable.

- Create or modify API routes for any new mutations (see framework stack file for route conventions). Every API route: validate input with zod, return proper HTTP status codes. If `stack.database` is present, use the server-side database client for data access.
- If database tables are needed: create a migration following the database stack file (next sequential number, `IF NOT EXISTS`), add TypeScript types, add post-merge instructions to PR body (CI auto-applies migrations on merge; otherwise `make migrate` or Supabase Dashboard). Note: concurrent branches may create conflicting migration numbers — resolve by renumbering the later-merged migration at merge time.
- **If Multi-layer** (fallback — only if the MVP Task Breakdown above was skipped, e.g., for Simple features that grew during implementation): implement in two sub-steps with an intermediate build check:
  - Sub-step 6a — Data and server layer (migrations, types, API routes)
  - Re-read `.claude/current-plan.md` to confirm sub-step 6a output aligns with the approved plan.
  - Checkpoint: run `npm run build`. Fix errors before proceeding. If still broken after 2 attempts, proceed to Sub-step 6b without retrying — Step 7 (verification) has its own 3-attempt retry budget.
  - Sub-step 6b — Client/output layer (pages/endpoints/commands, components if applicable, analytics wiring)
