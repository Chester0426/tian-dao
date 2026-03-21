---
description: "Unified verification: build, agent review, E2E tests. Run after /bootstrap or /change. Also works standalone as a quality gate."
type: code-writing
reads:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
stack_categories: [testing, framework, analytics]
requires_approval: false
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
branch_prefix: fix
modifies_specs: false
---
Unified verification: build, agent review, E2E tests, and (in bootstrap-verify mode) PR creation.

## Step 0: Read context + detect mode

1. **Detect mode** by checking `.claude/current-plan.md`:
   - If it exists with frontmatter `skill: bootstrap` and `checkpoint: awaiting-verify` → **bootstrap-verify** mode
   - If it exists with frontmatter `skill: change` → **change-verify** mode
   - If it does not exist → **standalone** mode

   State the detected mode: "Running in **[mode]** mode."

2. **Determine scope**:
   - bootstrap-verify → `full`
   - change-verify → from current-plan.md frontmatter `scope` field
   - standalone → `full`

3. **Read context files**:
   - Read `experiment/experiment.yaml` — understand pages (from golden_path), behaviors, stack
   - Read `experiment/EVENTS.yaml` — understand tracked events
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`)
   - If in bootstrap-verify or change-verify mode: read all files listed in current-plan.md `context_files`
   - If `stack.testing` is present in experiment.yaml, read `.claude/stacks/testing/<value>.md`. Determine the test command and verify prerequisites (configuration file exists, dev packages installed).

4. **Create durable artifacts** (STATE 0 from verify.md):
   - Write `.claude/verify-context.json` with scope, archetype, quality, timestamp, and run_id
   - Create `.claude/fix-log.md` with header `# Error Fix Log`
   - `rm -rf .claude/agent-traces && mkdir -p .claude/agent-traces`

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

## Step 1: Build & lint loop

Follow the Build & Lint Loop in `.claude/patterns/verify.md` (max 3 attempts). If all 3 attempts fail, stop and report to the user.

## Step 2: Phase 1 — parallel read-only agents

Follow the Agent Trace Directory setup and Phase 1 sections in `.claude/patterns/verify.md` with the scope from Step 0. Spawn all scope-appropriate read-only agents in parallel. Wait for all to complete.

## Step 3: Phase 2 — serial edit-capable agents

Follow Phase 2 in `.claude/patterns/verify.md` with the scope from Step 0.
- design-critic → `npm run build` check → ux-journeyer → `npm run build` check
- Each agent runs serially; build must pass between them.

## Step 4: Merge security → security-fixer

Follow STATE 4 (SECURITY_MERGE_FIX) in `.claude/patterns/verify.md`. Always write `.claude/security-merge.json`, `.claude/design-ux-merge.json` when scope includes security agents (even with 0 issues). Only spawn security-fixer when merged issues > 0.

## Step 5: E2E tests

Follow STATE 5 (E2E_TESTS) in `.claude/patterns/verify.md`.

**If all 3 attempts fail:**
- **standalone mode**: Follow `.claude/patterns/branch.md` with prefix `fix` and name `fix/e2e-failures` (if not already on a fix branch). Report to user with attempt history. Offer: (1) tell me what to try, (2) save progress as WIP commit on this branch.
- **bootstrap-verify or change-verify**: Report failures to the user with attempt history. Offer: (1) tell me what to try, (2) save progress as WIP commit.

## Step 6: Auto-observe + verify report + save patterns

1. Follow Auto-Observe in `.claude/patterns/verify.md` (skip if Error Fix Log is empty)
2. Follow Write Verification Report in `.claude/patterns/verify.md` — includes completion audit and trace audit
3. Follow Save Notable Patterns in `.claude/patterns/verify.md` (if Fix Log is non-empty)

## Step 7: Finalize (mode-dependent)

### bootstrap-verify mode

- **BG3 Verification Gate**: Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG3 Verification Gate. Verify: .claude/verify-report.md exists with YAML frontmatter, build_attempts present with Result pass, agents_expected non-empty, agents_completed matches agents_expected, scope is full, auto_observe not skipped-no-fixes if fixes were applied, process_violation is absent or false in frontmatter, .claude/agent-traces/ contains .json files matching agents_completed count." If gate-keeper returns BLOCK, go back and complete the skipped steps — if process_violation is true, run the skipped agents or get explicit user approval.

- Stage all new and changed files
- Commit: "Bootstrap MVP scaffold from experiment.yaml"
- **BG4 PR Gate**: Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG4 PR Gate. Verify: on feature branch (not main), git status shows no uncommitted changes to tracked files, commit message follows imperative mood." If gate-keeper returns BLOCK, fix blocking items before pushing.
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md` format:
  - Include completion reports from all subagents for PR body context
  - Populate the PR Verification checklist from `.claude/verify-report.md` contents
- Delete `.claude/current-plan.md`, `.claude/current-visual-brief.md`, `.claude/verify-report.md`, `.claude/agent-traces/`, `.claude/verify-context.json`, `.claude/fix-log.md`, `.claude/security-merge.json`, `.claude/design-ux-merge.json`, `.claude/e2e-result.json`, `.claude/build-result.json`, `.claude/observer-diffs.txt`, and `.claude/patterns-saved.json`
- Report the PR URL to the user
- Tell the user: "Bootstrap complete. Next: review and merge the PR to `main`. Then run `/deploy` to deploy to production, or `/change` to make changes before deploying."
- If `quality: production` is set in experiment.yaml, also add:
  > "Production quality mode is active. After merging, run `/harden` to add TDD coverage to critical paths (auth, payment, data persistence)."

### change-verify mode

- Report verification results to the user
- Do NOT create a PR — `/change` Step 8 handles PR creation
- Do NOT delete `.claude/current-plan.md` — `/change` Step 8 needs it
- Leave `.claude/verify-report.md`, `.claude/agent-traces/`, `.claude/verify-context.json`, `.claude/fix-log.md`, `.claude/security-merge.json`, `.claude/design-ux-merge.json`, `.claude/e2e-result.json`, `.claude/build-result.json`, `.claude/observer-diffs.txt`, and `.claude/patterns-saved.json` in place for `/change` Step 8

### standalone mode

- If ALL tests pass (or no tests configured):
  - Report success with test count and summary. Tell the user next steps:
    - **On a feature branch**: "All tests pass. Merge this PR to `main`, then run `/deploy` to deploy to production."
    - **On `main`**: "All tests pass. Run `/deploy` to deploy to production, or run `/change` to make more improvements before deploying."
    - **If archetype is `cli`**: replace `/deploy` guidance with: "CLIs are distributed via package registries — see `.claude/archetypes/cli.md` for details."
  - **Done.** No branch, no PR, no further steps.
- If ALL tests pass BUT `git status` shows modified/untracked files outside `.claude/`:
  1. Create branch `fix/verify-$(date +%Y-%m-%d)` from current HEAD
  2. Stage all modified/untracked files and commit: "Fix verification issues found by /verify"
  3. Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md` format:
     - **Summary**: verification agents found and fixed issues
     - **How to Test**: "Run `npm run build` and tests — all should pass"
     - **What Changed**: files modified by verification agents
     - **Why**: quality issues found during standalone verification
  4. Delete `.claude/verify-report.md`, `.claude/agent-traces/`, `.claude/verify-context.json`, `.claude/fix-log.md`, `.claude/security-merge.json`, `.claude/design-ux-merge.json`, `.claude/e2e-result.json`, `.claude/build-result.json`, `.claude/observer-diffs.txt`, and `.claude/patterns-saved.json` after PR is created
  5. Tell the user: "Verification fixes applied. PR created: <URL>."
- If tests failed and fixes were committed on a `fix/` branch:
  - > **Gate check:** Read `.claude/verify-report.md`. If it does not exist,
  > STOP — go back and run Step 6 above.
  - Commit: descriptive message about what was fixed
  - Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md`:
    - **Summary**: what tests were failing and what was fixed
    - **How to Test**: "Run the test command — all tests should pass"
    - **What Changed**: files modified and why
    - **Why**: tests were failing; fixes ensure the experiment is ready to deploy
    - **Checklist**: standard checks
  - Delete `.claude/verify-report.md`, `.claude/agent-traces/`, `.claude/verify-context.json`, `.claude/fix-log.md`, `.claude/security-merge.json`, `.claude/design-ux-merge.json`, `.claude/e2e-result.json`, `.claude/build-result.json`, `.claude/observer-diffs.txt`, and `.claude/patterns-saved.json` after PR is created
  - Tell the user: "Next: merge this PR to `main`, pull (`git checkout main && git pull`)." If archetype is `cli`, add CLI-specific guidance. Otherwise, add: "Then run `/deploy` to deploy to production."

## Cleanup

After all steps complete (any mode): if `STARTED_SUPABASE=true`, run `npx supabase stop`.

## Do NOT
- Modify experiment.yaml or experiment/EVENTS.yaml
- Add new features — only fix what tests and agents expose
- Run tests against production (always use local dev server)
- Skip the build verification step
- Skip agent review steps required by the scope
- Commit to main directly
- Create a PR in change-verify mode (that's /change's job)
