---
description: "Run E2E tests and fix failures. Use after /change and before deploy as a quality gate."
type: code-writing
reads:
  - experiment/experiment.yaml
  - EVENTS.yaml
stack_categories: [testing, framework, analytics]
requires_approval: false
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
branch_prefix: fix
modifies_specs: false
---
Run E2E tests against the local dev server and fix any failures.

## Step 0: Read context

- Read `experiment/experiment.yaml` — understand pages (from golden_path), behaviors, stack
- Read `EVENTS.yaml` — understand tracked events
- Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`).
- If `stack.testing` is NOT present in experiment.yaml, stop: "No testing stack configured. Add `testing: vitest` (or another test runner) to experiment.yaml `stack` and run `/change add tests` to set up testing, or run `npm run build` to verify the app compiles."
- If `stack.testing` is present in experiment.yaml, read `.claude/stacks/testing/<value>.md`. It specifies the test runner, test command, prerequisites, and configuration file. Do NOT hardcode any specific test runner. Then, while still inside this `stack.testing` guard:
  - Determine the test command (`playwright` → `npx playwright test`, `vitest` → `npx vitest run`, other → per stack file)
  - Verify the configuration file exists (e.g., `playwright.config.ts` for Playwright, `vitest.config.ts` for Vitest). If not: "No test configuration found. Run `/change add tests` to set up testing."
  - Verify the required dev packages are in package.json devDependencies. If not: "Test runner is not installed. Run `npm install -D <packages listed in the stack file>`."

### Full-Auth prerequisite checks (only when testing stack file's `assumes` includes `database/supabase`)

If the testing stack file's `assumes` list includes `database/supabase` and `auth/supabase`:

1. Check Docker is running: `docker info`. If it fails: stop and tell the user
   "Docker Desktop is required for full-auth E2E tests. Start Docker Desktop and retry."
2. Check `supabase/config.toml` exists. If not: stop and tell the user
   "Run `npx supabase init` to create supabase/config.toml (bootstrap does this
   automatically for full-auth projects)."
3. Check if local Supabase is already running: `npx supabase status`. If not running,
   start it: `npx supabase start -x realtime,storage,imgproxy,inbucket,pgadmin-schema-diff,migra,postgres-meta,studio,edge-runtime,logflare,pgbouncer,vector`.
   Set an internal flag `STARTED_SUPABASE=true` so you know to stop it later.
4. Apply migrations: `npx supabase db reset`

## Step 1: Run tests

- Run the test command determined in Step 0 (e.g., `npx playwright test` for Playwright, `npx vitest run` for Vitest)
- Capture the full output

## Step 2: Report results

- If ALL tests pass: if `STARTED_SUPABASE=true`, run `npx supabase stop`. Report success with test count and summary. Then tell the user next steps based on context:
  - **On a feature branch**: "All tests pass. Merge this PR to `main`, then run `/deploy` to deploy to production."
  - **On `main`**: "All tests pass. Run `/deploy` to deploy to production, or run `/change` to make more improvements before deploying."
  - **If archetype is `cli`**: replace `/deploy` guidance with: "CLIs are distributed via package registries — see `.claude/archetypes/cli.md` for details. To publish: run `npm publish` (npm registry) or create a GitHub Release (binary distribution). If a surface is configured, run `/deploy` first to deploy the marketing page, then publish the CLI. After publishing and collecting usage data, run `/iterate` to review metrics, or `/retro` when ready to wrap up the experiment."
  **Done.** No branch, no PR, no further steps.
- If any tests fail: proceed to Step 3

## Step 3: Branch setup

Follow `.claude/patterns/branch.md` with prefix `fix` and name `fix/e2e-failures`.

## Step 4: Fix failures (max 3 attempts)

For each attempt:
1. Read the test output — identify which tests failed and why
2. Read the failing test files and the app code they exercise
3. Fix the issues (may be test code or app code — fix whatever is actually wrong)
4. Re-run the test command from Step 0
5. If all pass: proceed to Step 5
6. If still failing: note what you tried, start next attempt

If all 3 attempts fail: if `STARTED_SUPABASE=true`, run `npx supabase stop`. Report to the user with attempt history and remaining errors.
Offer options: (1) tell me what to try, (2) save progress as WIP commit on this branch.

## Step 5: Verify build

Follow the FULL verification procedure in `.claude/patterns/verify.md`:
1. Build & lint loop (max 3 attempts)
2. Save notable patterns (if you fixed errors)
3. Template observation review (ALWAYS — even if no errors were fixed)

## Step 6: Commit, push, open PR

> **Gate check:** Read `.claude/verify-report.md`. If it does not exist,
> STOP — go back and run Step 5 above. Do NOT commit without a verification report.

- Commit: descriptive message about what was fixed (e.g., "Fix landing page title assertion in E2E smoke test")
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md`:
  - **Summary**: what tests were failing and what was fixed
  - **How to Test**: "Run `npm test` (or `npm run test:e2e` for Playwright) — all tests should pass"
  - **What Changed**: files modified and why
  - **Why**: tests were failing; fixes ensure the experiment is ready to deploy
  - **Checklist**: standard checks
- Delete `.claude/verify-report.md` after PR is created.
- After PR is created, tell the user: "Next: merge this PR to `main`, pull (`git checkout main && git pull`)." If the archetype is `cli`, add: "Then publish via `npm publish` or GitHub Releases — see the archetype file." Otherwise, add: "Then run `/deploy` to deploy to production."

## Cleanup

After tests complete (whether all pass or after Step 6): if `STARTED_SUPABASE=true`, run `npx supabase stop` to shut down the local Supabase instance this skill started.

## Do NOT
- Modify experiment.yaml or EVENTS.yaml
- Add new features — only fix what tests expose
- Run tests against production (always use local dev server)
- Skip the build verification step
- Commit to main directly
