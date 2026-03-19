---
description: "Transition an MVP to production quality mode. Scans code, plans hardening, adds specification tests to critical paths."
type: code-writing
reads:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
  - CLAUDE.md
stack_categories: [framework, database, auth, analytics, testing]
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/tdd.md
  - .claude/patterns/observe.md
  - .claude/patterns/recovery.md
  - .claude/agents/implementer.md
branch_prefix: chore
modifies_specs: true
---
Transition this MVP to production quality mode: $ARGUMENTS

## Step 0: Validate preconditions

- `package.json` exists (app is bootstrapped). If not → stop: "No app found. Run `/bootstrap` first."
- `npm run build` passes. If not → stop: "App has build errors. Run `/change fix build errors` first."
- If `quality: production` already set in experiment.yaml AND no `$ARGUMENTS`: stop — "Already in production mode. Use `/harden <module>` to harden a specific module, or `/change` for new features."
- If `.claude/current-plan.md` exists AND the current branch starts with `chore/harden`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `archetype`, `stack`, `checkpoint`, and `modules` from frontmatter. If parsing fails (invalid YAML or missing required fields): stop — "Plan file has corrupted frontmatter. Delete `.claude/current-plan.md` and re-run `/harden` to start fresh."
     - Use these values directly — do NOT re-scan or re-classify
     - Read all files listed in `context_files` to restore source-of-truth context. If a listed file no longer exists, skip it and warn the user.
     - Resume at the step indicated by `checkpoint`:
       - `step2-approval` → Step 2 (plan ready, waiting for approval)
       - `step3-setup` → Step 3.1 (branch + config setup)
       - `step3-module-N` → Step 3.4 at module N (skip completed modules)
       - `step3-reconcile` → Step 3.6 (all modules done, reconciliation)
       - `step3-verify` → Step 3.8 (run /verify)
       - `step3-pr` → Step 3.9 (commit/push/PR)
     - Tell user: "Resuming /harden from [checkpoint]. [M of N] modules completed.\n  Done: [list completed module names]. Remaining: [list remaining module names].\n  Do NOT re-run completed modules."
  2. If no frontmatter (old format): fall back — scan for CRITICAL modules without test files and proceed from Step 3.4.
- If on a `chore/harden-*` branch with existing specification tests but NO `.claude/current-plan.md`: a previous `/harden` may have partially completed. Tell the user: "Found existing hardening work on this branch. Scanning for modules that still need tests..." Then scan for CRITICAL modules without test files and proceed from Step 3.4.

## Step 1: Scan & classify

- Read `experiment/experiment.yaml` (behaviors, golden_path, stack, type)
- Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`)
- Scan for modules based on archetype:
  - **web-app**: `src/app/` (pages and API routes), `src/components/`, `src/lib/`
  - **service**: `src/app/api/` (endpoints), `src/lib/`
  - **cli**: `src/commands/`, `src/lib/`
- Glob for existing tests (`**/*.test.*`, `**/*.spec.*`, `e2e/**`)
- Classify each module into 4 categories:

  **CRITICAL** (harden now): Auth/session logic, payment/billing, data mutations (POST/PUT/DELETE API routes with DB writes), golden_path activation steps (web-app: pages, service: endpoints, cli: commands), behaviors with `actor: system/cron`, non-trivial business logic

  **ON-TOUCH** (harden when next modified): Read-only API routes (GET), form validation, data fetching/transformation, golden_path non-value-moment steps

  **SKIP** (no hardening needed): Page/view components (rendering + layout only — web-app only), UI components, static content, configuration

  **ALREADY COVERED**: Modules with existing test files (list them)

## Step 2: Present plan — STOP for approval

```
## Hardening Plan: [project-name]

### Current State
- Modules: N total, M tested, K untested-critical

### Dependency Order
- Independent: [modules with no cross-dependencies] — can proceed in any order
- Sequential: [module B] depends on [module A] — harden A first
- (Or: "All modules are independent — no ordering constraints")

### Will Harden (Critical, no tests):

#### 1. [module name]
- **Files:** [source file paths]
- **Why critical:** [classification reason from Step 1]
- **Behaviors:** [b-NN: description], [b-NN: description] (from experiment.yaml)
- **Specifications to test:**
  - [concrete assertion derived from behaviors + code reading]
  - [e.g., "POST /api/invoices creates invoice record with authenticated user's org_id"]
  - [e.g., "Returns 401 when session is missing"]
  - [e.g., "Validates required fields (amount, due_date) with zod schema"]
- **Test count:** N specification tests

#### 2. [module name]
- (same structure as above)

### On-Touch (Important, defer):
- [module] — [reason]

### Skip:
- [module] — [reason: UI-only / already covered]

### Changes:
- experiment.yaml: add quality: production
- experiment.yaml: add stack.testing if absent
```

If K (untested-critical modules) is 0: replace the plan prompt with:

> No critical untested modules found — all critical modules already have tests.
> Options:
> 1. **proceed** — set `quality: production` in experiment.yaml (enables TDD for future /change runs)
> 2. **harden on-touch** — also add specification tests to the On-Touch modules listed above
> 3. Or run `/change` to continue building features — they'll use TDD once production quality is set

Wait for user choice. If "proceed": skip Step 3 module loop (no modules to harden), execute Steps 3.1–3.3 (branch, config, testing setup) then jump directly to Steps 3.7–3.9 (ON-TOUCH, verify, PR). When saving the plan frontmatter, set `checkpoint: step3-reconcile` (not `step3-module-1`, since there are no modules — reconciliation is a no-op for K=0, then execution proceeds to ON-TOUCH, verify, PR). If "harden on-touch": promote On-Touch modules to the Will Harden section, re-present the plan with those modules, and wait for approval.

Otherwise (K > 0), present the standard prompt:

> Plan ready. How would you like to proceed?
> 1. **approve** — continue implementation now
> 2. **approve and clear** — save plan, then clear context for a fresh start
> 3. Or tell me what to change

DO NOT proceed until the user explicitly replies with approval.

**Save the approved plan.** Write the plan to `.claude/current-plan.md` with YAML frontmatter:

```yaml
---
skill: harden
archetype: [from experiment.yaml type, default web-app]
branch: chore/harden-production
stack: { [category]: [value], ... }
checkpoint: step3-setup
modules:
  - name: [module-1-name]
    files: [source file paths]
    behaviors: [b-NN, b-NN]
  - name: [module-2-name]
    files: [source file paths]
    behaviors: [b-NN]
context_files:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
  - .claude/archetypes/[archetype].md
  - [each .claude/stacks/<category>/<value>.md read in Step 1]
---
```

Then append the plan body. The `modules` list preserves the dependency-ordered sequence so resume knows which modules are done and which are next.

If the user replied **"approve and clear"** or **"2"**:
  1. Save the plan with frontmatter (same as above)
  2. Tell the user: "Plan saved. Run `/clear`, then re-run `/harden`. I'll resume at the checkpoint."
  3. STOP — do NOT proceed to Step 3.

## Step 3: Execute (after approval)

1. Branch setup (`chore/harden-production`) per `patterns/branch.md`
2. Set `quality: production` in experiment.yaml
3. Add `stack.testing` if absent (playwright for web-app, vitest for service/cli). Install testing packages per testing stack file.

Update checkpoint in `.claude/current-plan.md` frontmatter to `step3-module-1`.

> **Checkpoint update:** Edit only the `checkpoint:` line in the frontmatter — single-line edit, not a full file rewrite.

4. **Module dependency analysis** (per `patterns/tdd.md` Task Dependency Ordering):
   - For each approved CRITICAL module, identify imports from other CRITICAL modules
   - Order modules so dependencies are hardened first (if A imports B, harden B first)
   - Independent modules can be in any order — place them first
   - The plan's Dependency Order section (Step 2) already shows this — use that order

5. For each approved CRITICAL module **in dependency order, sequentially**:
   a. Spawn implementer agent (`agents/implementer.md`, isolation: "worktree")
   b. Pass to implementer: file paths, the "Specifications to test" list from the approved plan, and mapped experiment.yaml behavior IDs (b-NN)
   c. Implementer writes specification tests per `patterns/tdd.md`:
      - What SHOULD the module do? (from the plan's specifications list + code reading)
      - Write tests for correct behavior
      - If test fails AND failure shows incorrect behavior → fix the code (bug discovery protocol)
      - If test passes → specification captured
   d. Run `npm run build` — if broken, fix before next module
   e. Log: "Module [name]: N tests added, all passing"
   f. Update checkpoint in `.claude/current-plan.md` frontmatter to `step3-module-[next]` (where [next] is the 1-indexed number of the next module to process)

6. **Consistency reconciliation**: After all implementer worktrees are merged, scan the combined result for:
   - **Naming**: grep for similar functions across hardened modules (e.g., multiple `validate*Email` variants). Pick the most descriptive name and rename others.
   - **Error patterns**: check API route handlers for response shape consistency. Normalize to the most common pattern.
   - **Duplicate utilities**: if 3+ near-identical logic blocks exist, extract to shared utility (per Rule 4).
   - **Import style**: normalize to the convention in the framework stack file.
   Budget: 5 minutes. Only fix what is listed above.

Update checkpoint to `step3-reconcile`.

7. **Persist ON-TOUCH list**: Write the ON-TOUCH module list from Step 1 to `experiment/on-touch.yaml`:
   ```yaml
   # Auto-generated by /harden. Modules to harden when next modified.
   # /change reads this file in production mode.
   on_touch:
     - path: src/app/api/invoices/route.ts
       reason: "Read-only GET, no mutations"
   ```
   Remove entries when a module gets spec tests via `/change` or a subsequent `/harden` run.

Update checkpoint to `step3-verify`.

8. Run full verification: `/verify` with **scope: full** (the default scope). This spawns all agents including spec-reviewer (conditional on `quality: production`, which Step 3.2 just set).

Update checkpoint to `step3-pr`.

9. **Gate check:** Read `.claude/verify-report.md`. If it does not exist, STOP — go back and run step 8 above. Do NOT commit without a verification report.

   Commit, push, open PR. Populate the PR Verification checklist from `.claude/verify-report.md` contents. After the PR is created, delete `.claude/current-plan.md` and `.claude/verify-report.md`.

Key design decisions:
- Dependency-ordered sequential execution — fail-fast prevents cascading breakage, dependencies satisfied before dependents
- Implementer agents use `isolation: "worktree"` per Agent tool pattern
- Implementers receive the "Specifications to test" list from the plan — no re-derivation needed
- Spec-reviewer included in verify step (conditional 6th agent)
- Re-run detection: `quality: production` already set + no $ARGUMENTS → stop
- Checkpoint-based resume: `.claude/current-plan.md` with YAML frontmatter enables exact resume after /clear or context overflow

## Step 4: Post-merge guidance

After PR is created, tell the user:

```
Production quality mode is now active.
- All future /change Feature, Fix, and Upgrade changes use TDD automatically.
- On-touch modules will be hardened when you next /change them.
- Run /verify to confirm all tests pass.
```

## Do NOT
- Skip the approval step (Step 2) — the user must review the hardening plan
- Harden UI-only components or static content — specification tests add no value there
- Run modules in parallel — sequential execution prevents cascading breakage
- Skip the verify step — spec-reviewer must validate test-to-spec alignment
- Add tests for hypothetical edge cases — test what the code SHOULD do per experiment.yaml
- Commit to main directly
