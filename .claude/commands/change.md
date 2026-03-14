---
description: "Use for any modification to an existing bootstrapped app: new features, bug fixes, UI polish, analytics fixes, or adding tests."
type: code-writing
reads:
  - experiment/experiment.yaml
  - EVENTS.yaml
  - CLAUDE.md
stack_categories: [framework, database, auth, analytics, ui, payment, email, testing, hosting]
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
  - .claude/patterns/messaging.md
  - .claude/patterns/design.md
  - .claude/procedures/plan-exploration.md
  - .claude/procedures/plan-validation.md
branch_prefix: change
modifies_specs: true
---
Make a change to the existing app: $ARGUMENTS

## Step 0: Pre-flight checks (before branch creation)

- If `$ARGUMENTS` is empty or unclear: stop and ask the user to describe what they want to change.
- If `$ARGUMENTS` contains `#<number>` or is just a number: read the GitHub issue via `gh issue view <number>` and use its content as the change description. If `gh issue view` fails (issue not found, permission denied, or network error), tell the user: "Could not read issue #<number>. Describe the change directly, or check `gh auth status` and retry."
- Verify `package.json` exists. If not, stop and tell the user: "No app found. Run `/bootstrap` first, or if you already have a bootstrap PR open, merge it before running `/change`."
- Verify `EVENTS.yaml` exists. If not, stop and tell the user: "EVENTS.yaml not found. This file defines all analytics events and is required. Restore it from your template repo or re-create it following the format in the EVENTS.yaml section of the template."
- Run `npm run build` to confirm the project compiles before making changes (unless `$ARGUMENTS` describes a fix). If the build fails and the change is not a build fix: stop and tell the user: "The app has build errors that need to be fixed first. Run `/change fix build errors` to address them."

## Step 1: Branch Setup

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `change` and slugify `$ARGUMENTS` for the branch name.

## Step 2: Read context

- Read `experiment/experiment.yaml` — understand the current scope, pages (derived from golden_path), existing behaviors, target user, thesis
- Read `EVENTS.yaml` — understand existing analytics events (this is the canonical event list)
- Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`). If the archetype is `service`, "pages" planning becomes "endpoint" planning — new capabilities map to API routes, not page folders. Skip Fake Door and landing page references. If the archetype is `cli`, new capabilities map to subcommand modules (`src/commands/`), not page folders or API routes. Skip Fake Door, landing page, and API route references.
- Resolve the stack: read experiment.yaml `stack`. For each category, read `.claude/stacks/<category>/<value>.md`. If a stack file doesn't exist for a given value, generate it: read `.claude/stacks/TEMPLATE.md` for the schema, read existing files in the same category as reference, and create `.claude/stacks/<category>/<value>.md` with complete frontmatter and code templates. Run `python3 scripts/validate-frontmatter.py` to verify (max 2 fix attempts). If validation fails, stop: "Could not generate a valid stack file for `<category>/<value>`. Create it manually using TEMPLATE.md as a guide." File an observation per `.claude/patterns/observe.md` for the missing stack file.
- Scan `src/app/` to understand the current page structure and codebase state
- **Explore codebase for planning context**: Follow `.claude/procedures/plan-exploration.md`. Exploration depth depends on the change type — do a preliminary classification from $ARGUMENTS keywords (adds/creates/new → Feature depth, replaces/upgrades/integrate → Upgrade depth, fixes/broken/bug → Fix depth, polish/improve/visual → Polish depth, analytics/tracking → Analytics depth, test/spec/e2e → Test depth). Store results in working memory for Phase 1. If auto memory has a "Planning Patterns" section, read it and incorporate relevant patterns into the exploration.
- If `.claude/iterate-manifest.json` exists, read it for context:
  - Include the verdict, bottleneck, and recommendations in the plan (Phase 1)
  - Reference: "This change addresses the [bottleneck.stage] bottleneck identified by /iterate ([bottleneck.diagnosis])"
  - This provides continuity between analysis and implementation

## Step 3: Classify the change

Determine the type from `$ARGUMENTS`:

| Type      | Signal                                     |
|-----------|---------------------------------------------|
| Feature   | Adds capability that doesn't exist today    |
| Upgrade   | Replaces Fake Door or stub with real integration |
| Fix       | Repairs broken behavior                     |
| Polish    | Improves UX/copy/visuals of existing stuff  |
| Analytics | Fixes/audits analytics coverage             |
| Test      | Adds or fixes tests                         |

State the classification before proceeding: "I'm treating this as a **[type]** change."

Map the classification to a verification scope for Step 7:

| Type      | Verification Scope |
|-----------|--------------------|
| Feature   | `full`             |
| Upgrade   | `full`             |
| Fix       | `security`         |
| Polish    | `visual`           |
| Analytics | `build`            |
| Test      | `build`            |

State: "Verification scope: **[scope]**"

## Step 4: Check type-specific preconditions

- If `.claude/current-plan.md` exists and the current branch starts with `change/`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `type`, `scope`, `archetype`, `stack`, and `checkpoint` from frontmatter
     - Use these values directly — do NOT re-classify or re-resolve stack
     - Read archetype file and stack files using frontmatter values
     - Read all files listed in `context_files` to restore source-of-truth context (experiment.yaml, EVENTS.yaml, etc.). If a listed file no longer exists, skip it and warn the user.
     - Resume at the step indicated by `checkpoint`:
       - `phase2-gate` → Phase 2 Pre-flight (read procedures, write process checklist)
       - `phase2-step5` → Step 5 (update specs)
       - `phase2-step6` → Step 6 (specs done, implement — re-read the plan to determine which type constraints apply)
       - `phase2-step7` → Step 7 (implementation done, verify)
       - `phase2-step8` → Step 8 (verification done, commit/PR)
     - Tell user: "Resuming from [checkpoint]. Type: [type], Scope: [scope]."
  2. If no frontmatter (old format): fall back to current behavior — skip Phase 1, jump to Step 5.
> **If resuming from a failed /change:** see `.claude/patterns/recovery.md`. The plan in `.claude/current-plan.md` persists across sessions.
- For analytics changes: verify the analytics library file exists (see analytics stack file for expected path). If it doesn't, stop and tell the user: "Analytics library not found. Run `/bootstrap` first."
- If `$ARGUMENTS` mentions payment or the change will add `payment` to the stack: verify `stack.auth` and `stack.database` are present in experiment.yaml. If `stack.auth` is missing, stop: "Payment requires authentication. Add `auth: supabase` (or another auth provider) to experiment.yaml `stack` first." If `stack.database` is missing, stop: "Payment requires a database. Add `database: supabase` (or another database provider) to experiment.yaml `stack` first."
- If `$ARGUMENTS` mentions email or the change will add `email` to the stack: verify `stack.auth` and `stack.database` are present in experiment.yaml. If `stack.auth` is missing, stop: "Email requires authentication to know who to send emails to. Add `auth: supabase` (or another auth provider) to experiment.yaml `stack` first." If `stack.database` is missing, stop: "Email requires a database to track user activation status. Add `database: supabase` (or another database provider) to experiment.yaml `stack` first."
- If `testing` is present in experiment.yaml `stack` and the classified type is NOT Test: read the testing stack file's `assumes` list and verify each `category/value` pair against experiment.yaml `stack`. If any assumption is unmet, stop: "Your testing setup assumes [unmet dependencies]. Tests will break. Run '/change fix test configuration' first, or remove 'testing' from experiment.yaml 'stack'."
- If `quality: production` is set in experiment.yaml AND change type is Feature, Fix, or Upgrade:
  * Verify `stack.testing` is present in experiment.yaml
  * If absent: stop — "Production quality requires a testing framework. Add `testing: playwright` (web-app) or `testing: vitest` (service/cli) to experiment.yaml `stack`, or remove `quality: production` for MVP mode."
- If classified as Test type: check archetype compatibility first — if archetype is `service` or `cli` and `stack.testing` is `playwright`, stop: "Playwright requires a browser and is not compatible with the `<archetype>` archetype. Use `testing: vitest` instead." Then read the testing stack file's `assumes` list and check each `category/value` against experiment.yaml `stack` (per bootstrap's validation approach: the value must match, not just the category). Record the result — this determines the template path reported in the plan.
- If classified as Upgrade: scan for a Fake Door or stub related to the feature described in `$ARGUMENTS`. Where to scan depends on the archetype: web-app → scan `src/app/` for a Fake Door component (`fake_door: true` in a `track()` call) or a stub route (501/503); service → scan route handlers (path per framework stack file) for a stub route (501/503 with `"Service not configured"`); cli → scan `src/commands/` for a stub command (prints "Coming soon" or exits with error). If neither a Fake Door nor a stub is found, reclassify as Feature and tell the user: "No Fake Door or stub found for this feature — treating as a new Feature instead."

---

## Phase 1: Plan (BEFORE writing any code)

DO NOT write any code, create any files, or run any install commands during this phase.

Present the plan using the template for the classified type from `.claude/procedures/change-plans.md`. Populate "How" sections using exploration results from Step 2.

**Validate the plan against the codebase**: Before presenting the plan to the user, follow `.claude/procedures/plan-validation.md`. If validation flags conflicts, adjust the plan or add items to the Questions section prefixed with "[Validation]".

### STOP. End your response here. Say:
> Plan ready. How would you like to proceed?
> 1. **approve** — continue implementation now
> 2. **approve and clear** — save plan, then clear context for a fresh start
> 3. **skip** — cancel this change and delete the feature branch
> 4. Or tell me what to change

DO NOT proceed to Phase 2 until the user explicitly replies with approval.
If the user selects "skip": run `git checkout main && git branch -D <branch-name>`, tell the user "Change cancelled. Branch deleted. Run `/change` again when ready." and stop.
If the user requests changes instead of approving, revise the plan to address their feedback and present it again. Repeat until approved.

Save the approved plan to `.claude/current-plan.md` with YAML frontmatter:

```yaml
---
skill: change
type: [classification from Step 3]
scope: [verification scope from Step 3]
archetype: [from experiment.yaml type, default web-app]
branch: [current git branch name]
stack: { [category]: [value], ... }
checkpoint: phase2-gate
context_files:
  - experiment/experiment.yaml
  - EVENTS.yaml
  - .claude/archetypes/[archetype].md
  - [each .claude/stacks/<category>/<value>.md read in Step 2]
---
```

Then append the plan body. The frontmatter enables resume-after-clear without re-deriving classification, scope, or stack.

If the user replied **"approve and clear"** or **"2"**:
  1. Save the plan with frontmatter (same as above)
  2. Tell the user: "Plan saved. Run `/clear`, then re-run `/change [original $ARGUMENTS]`. I'll resume at the checkpoint."
  3. STOP — do NOT proceed to Phase 2.

---

## Phase 2: Implement (only after the user has approved)

### Phase 2 Pre-flight: Process Gate

> This step creates a data dependency: writing the checklist requires reading
> the procedure files. Runs once per plan — idempotent.

Before proceeding to Step 5, execute the process gate:

1. **Read the procedure file for the classified type:**
   | Type | File to Read |
   |------|-------------|
   | Feature | `.claude/procedures/change-feature.md` |
   | Upgrade | `.claude/procedures/change-upgrade.md` |
   | Fix | `.claude/procedures/change-fix.md` |
   | Test | `.claude/procedures/change-test.md` |
   | Polish | (none — constraints are inline in Step 6) |
   | Analytics | (none — constraints are inline in Step 6) |

2. **If `quality: production`:** also read `.claude/patterns/tdd.md`.

3. **Always read** `.claude/patterns/verify.md` — extract the scope table and agent list for the verification scope from Step 3.

4. **Append a `## Process Checklist` section** to `.claude/current-plan.md`:

   ```markdown
   ## Process Checklist
   - Implementation mode: [MVP direct | Production TDD]
   - Procedure file: [filename | inline (Polish/Analytics)]
   - Verification scope: [scope] → agents: [agent list from verify.md scope table]
   - Type-specific constraints:
     - [3-5 key rules extracted from the procedure file]
   ```

   If `quality: production`, add to the constraints list:
   - Feature/Upgrade: `- Implementer agents required — do NOT implement directly`
   - Feature/Upgrade: `- TDD cycle: RED (failing test) before GREEN (implementation)`
   - Fix: `- Regression test must FAIL on current code before writing fix`

5. **Update checkpoint** in `.claude/current-plan.md` frontmatter to `phase2-step5`.

> **Skip condition:** If `.claude/current-plan.md` already contains `## Process Checklist`, skip to Step 5.

### Step 5: Update specs (type-specific)

> **Gate check:** Read `.claude/current-plan.md` and look for `## Process Checklist`.
> If missing, STOP — execute the Phase 2 Pre-flight above first.

- **Feature**: add the new behavior to experiment.yaml `behaviors` list. If the new behavior changes the user journey (adds a page to the main flow, changes a CTA destination, or changes a key step), update `golden_path` in experiment.yaml accordingly. Do NOT remove or modify existing behaviors.
- **Upgrade**: do NOT modify experiment.yaml `behaviors` (the behavior already exists — it was listed when the Fake Door was created). Add new env vars to `.env.example`.
- **Analytics**: if the user approved custom events, add them to the `events` map in EVENTS.yaml with appropriate `funnel_stage`, following the `<object>_<action>` naming convention with all properties.
- **Fix / Polish**: do NOT modify experiment.yaml or EVENTS.yaml.
- **Test**: do NOT modify EVENTS.yaml. If adding tests for the first time (no `stack.testing` in experiment.yaml and no `playwright.config.ts` on disk), add `testing: <value>` to experiment.yaml `stack` section. Do not modify other parts of experiment.yaml.

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-step6`.

> **Checkpoint update:** Edit only the `checkpoint:` line in the frontmatter — single-line edit, not a full file rewrite.

### Step 6: Make changes (type-specific)

#### Feature constraints
Follow the procedure in `.claude/procedures/change-feature.md`.

> **Critical assertions (Feature):**
> - If `quality: production` — you MUST spawn implementer agents. Do NOT implement tasks directly.
> - If `quality: production` — write the failing test (RED) BEFORE writing production code (GREEN).
> - Analytics events MUST be wired before proceeding to Step 7.

#### Upgrade constraints
Follow the procedure in `.claude/procedures/change-upgrade.md`.

> **Critical assertions (Upgrade):**
> - If `quality: production` — TDD tasks required for credential storage, webhook validation, error handling.
> - If `quality: production` — you MUST spawn implementer agents. Do NOT implement tasks directly.
> - Preserve the `activate` event name when replacing Fake Door — remove `fake_door: true` only.

#### Fix constraints
Follow the procedure in `.claude/procedures/change-fix.md`.

> **Critical assertions (Fix):**
> - If `quality: production` — regression test must FAIL on current code BEFORE writing the fix.
> - Minimal change only — fix root cause, no refactoring of surrounding code.

#### Polish constraints
- No new features, pages, routes, or libraries
- Copywriting: follow the copy derivation rules in `.claude/patterns/messaging.md` — headline = outcome for target_user, CTA = action verb + outcome. If the archetype includes a landing page (web-app): landing page must include all content inventory from messaging.md Section B. When experiment.yaml has `variants`, variant messaging fields (`headline`, `subheadline`, `cta`, `pain_points`) override Section A derivation — see messaging.md Section D.
- If the change modifies experiment.yaml `behaviors`, `name`, or `description` AND surface ≠ none: regenerate the surface to reflect the updated content. For web-app: update the landing page (`src/app/page.tsx` and landing components). For service (co-located): update the root route handler (file path per framework stack file, e.g., `src/app/route.ts` for Next.js). For service (detached) or cli: update `site/index.html`. Re-invoke `frontend-design` for the surface if the visual direction changed.
- Visual design: follow `.claude/patterns/design.md` quality invariants. Read existing pages and maintain visual consistency with the established design direction.
- Remove anything that doesn't serve conversion. Keep above-the-fold to: headline, subheadline, CTA.
- Count steps between CTA click and first value moment — remove or defer unnecessary fields
- Every required field: inline validation errors. Every async button: loading state. API errors: user-friendly messages.
- Spacing, hierarchy, and responsive layout must be visually consistent with existing pages
- Preserve all existing analytics events

#### Analytics constraints
- Fix gaps per the audit: add missing tracking calls with all required properties, add missing properties to incomplete calls
- Do NOT change event names — they must match EVENTS.yaml exactly
- Do NOT remove existing correct analytics calls
- Only add custom events the user explicitly approved

#### Test constraints
Follow the procedure in `.claude/procedures/change-test.md`.

> **CHECKPOINT — VERIFICATION GATE**
> Implementation is complete. You MUST now execute Step 7 in full.
> Re-read `.claude/patterns/verify.md` and follow every section applicable to the verification scope from Step 3:
> build loop, scoped parallel review, security fix cycle (if applicable), auto-observe.
> **Step 8 is BLOCKED until Step 7 completes.**
> Do NOT commit, push, or open a PR before verification finishes.
>
> **Critical assertions (Verification):**
> - If scope is `full` or `security` — security-defender + security-attacker MUST be spawned.
> - If `quality: production` — spec-reviewer MUST be spawned.
> - `.claude/verify-report.md` MUST be written before Step 8.

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-step7`.

### Step 7: Verify
- Follow the verification procedure in `.claude/patterns/verify.md` with **scope: [scope from Step 3]**:
  1. Build & lint loop (max 3 attempts)
  2. Save notable patterns (if you fixed errors)
  3. Template observation review (ALWAYS — even if no errors were fixed)
- **Note**: If `quality: production` is set in experiment.yaml, `/verify` automatically spawns spec-reviewer as an additional parallel agent (regardless of scope). spec-reviewer validates all behaviors are implemented and specification tests are present. No extra action needed — just be aware it runs.
- Re-read `.claude/current-plan.md` to verify implementation matches the approved plan. Check that every item in the plan has been addressed.
- Type-specific checks:
  - **Feature**: trace the user flow — can a user discover, use, and complete the feature? Verify all new analytics events fire.
  - **Fix**: trace the bug report's user flow through code to confirm it's fixed.
  - **Polish**: open each changed file and confirm analytics imports and event calls are intact.
  - **Analytics**: re-trace each standard funnel event through the code to confirm it now fires correctly.
  - **Production quality (if `quality: production`)**: verify.md spawns spec-reviewer in addition to scope-determined agents. Pass experiment.yaml + `.claude/current-plan.md` to spec-reviewer.
  - **Test**: verify test discovery works by running the testing stack file's test command in dry-run/list mode (e.g., `npx playwright test --list` for Playwright, `npx vitest run --reporter=verbose` for Vitest). If test discovery fails, treat it as a build error — fix the test files and re-run. If still failing after the verify.md retry budget, report to the user with the error output.
  - **Feature (spec compliance)**: Re-read `.claude/current-plan.md` and `experiment/experiment.yaml`. Verify implementation matches the archetype's primary units:
    - If archetype requires pages: confirm `src/app/<page-name>/page.tsx` exists for each unique page referenced in experiment.yaml `golden_path`
    - If archetype requires `endpoints`: confirm API route exists for each endpoint in experiment.yaml `endpoints` (path depends on framework stack file)
    - If archetype requires `commands` (cli): confirm `src/commands/<command-name>.ts` exists for each entry in the experiment.yaml command list
    - For each behavior in `behaviors`, confirm the implementation addresses it. For each event in `EVENTS.yaml`, confirm tracking calls are intact. If anything is missing, fix it before proceeding.

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-step8`.

### Step 8: Commit, push, open PR

> **Gate check:** Read `.claude/verify-report.md`. If it does not exist,
> STOP — go back and run Step 7 above. Do NOT commit without a verification report.

- You are already on a feature branch (created in Step 0). Do not create another branch.
- Commit message: imperative mood describing the change (e.g., "Add invoice email reminders", "Fix email validation on signup form", "Polish landing copy and error states")
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md` format:
  - **Summary**: plain-English description of the change
  - **How to Test**: steps to verify the change works after merging
  - **What Changed**: list every file created/modified and what changed
  - **Why**: how this change serves the target user and thesis. If from a GitHub issue, include `Closes #<number>`.
  - **Checklist — Scope**: check all boxes. For new behaviors: confirm experiment.yaml was updated.
  - **Checklist — Analytics**: list all new/modified events and which pages fire them. For fixes/polish: confirm no events were removed or broken.
  - **Checklist — Build**: confirm build passes, no hardcoded secrets
  - **Checklist — Verification**: populate from `.claude/verify-report.md` contents. If Step 7 was skipped or partially run, state why.
- Fill in **every** section of the PR template. Empty sections are not acceptable. If a section does not apply, write "N/A" with a one-line reason.
- If `git push` or `gh pr create` fails: show the error and tell the user to check their GitHub authentication (`gh auth status`) and remote configuration (`git remote -v`), then retry.
- Delete `.claude/current-plan.md` and `.claude/verify-report.md` — the plan is captured in the PR description and the verification results are in the PR checklist. Note: plan deletion happens AFTER Step 7 completes (spec-reviewer needs the plan during verification).
- **Save planning patterns**: If this change revealed planning-relevant patterns (auth flow interactions, stack integration quirks, codebase conventions discovered during exploration, schema design patterns), save a brief entry to auto memory under a "Planning Patterns" heading. These get consulted during future Phase 1 exploration via `.claude/procedures/plan-exploration.md` Step 5.
- Tell the user: "Change PR created. Next: review and merge to `main`. Run `/verify` to confirm tests pass." If the archetype is `cli`, add: "CLIs are distributed via `npm publish` or GitHub Releases — see the archetype file. After merging this PR to `main`, bump the version in `package.json` and run `npm publish` to release the update. After publishing and collecting usage data, run `/iterate` to review metrics, or `/retro` when ready to wrap up." Otherwise, add: "Then run `/deploy` if not yet deployed."

## Do NOT
- Add more than what `$ARGUMENTS` describes — one change per PR
- Modify existing behaviors unless the change requires integration (e.g., adding a nav link)
- Remove or break existing analytics events (unless the change is specifically about fixing analytics)
- Add libraries not in experiment.yaml `stack` without user approval
- Skip updating experiment.yaml when adding new behaviors — the source of truth must always reflect the current app
- Change analytics event names — they must match EVENTS.yaml
- Add custom analytics events without user approval
- Add error-state tests — funnel happy path only (Rule 4)
- Mock services in tests — the whole point is testing real integrations
- Skip Step 7 verification (verify.md must run with the classified scope — build loop and auto-observe always run; review agents run per scope)
- Commit to main directly
