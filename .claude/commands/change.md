---
description: "Use for any modification to an existing bootstrapped app: new features, bug fixes, UI polish, analytics fixes, or adding tests."
type: code-writing
reads:
  - idea/experiment.yaml
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
branch_prefix: change
modifies_specs: true
---
Make a change to the existing app: $ARGUMENTS

## Step 0: Pre-flight checks (before branch creation)

- If `$ARGUMENTS` is empty or unclear: stop and ask the user to describe what they want to change
- If `$ARGUMENTS` contains `#<number>` or is just a number: read the GitHub issue via `gh issue view <number>` and use its content as the change description. If `gh issue view` fails (issue not found, permission denied, or network error), tell the user: "Could not read issue #<number>. Describe the change directly, or check `gh auth status` and retry."
- Verify `package.json` exists. If not, stop and tell the user: "No app found. Run `/bootstrap` first, or if you already have a bootstrap PR open, merge it before running `/change`."
- Verify `EVENTS.yaml` exists. If not, stop and tell the user: "EVENTS.yaml not found. This file defines all analytics events and is required. Restore it from your template repo or re-create it following the format in the EVENTS.yaml section of the template."
- Run `npm run build` to confirm the project compiles before making changes (unless `$ARGUMENTS` describes a fix). If the build fails and the change is not a build fix: stop and tell the user: "The app has build errors that need to be fixed first. Run `/change fix build errors` to address them."

## Step 1: Branch Setup

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `change` and slugify `$ARGUMENTS` for the branch name.

## Step 2: Read context

- Read `idea/experiment.yaml` — understand the current scope, existing pages, existing features, target user, primary metric
- Read `EVENTS.yaml` — understand existing analytics events (this is the canonical event list)
- Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`). If the archetype is `service`, "pages" planning becomes "endpoint" planning — new capabilities map to API routes, not page folders. Skip Fake Door and landing page references. If the archetype is `cli`, new capabilities map to subcommand modules (`src/commands/`), not page folders or API routes. Skip Fake Door, landing page, and API route references.
- Resolve the stack: read experiment.yaml `stack`. For each category, read `.claude/stacks/<category>/<value>.md`. If a stack file doesn't exist for a given value, generate it: read `.claude/stacks/TEMPLATE.md` for the schema, read existing files in the same category as reference, and create `.claude/stacks/<category>/<value>.md` with complete frontmatter and code templates. Run `python3 scripts/validate-frontmatter.py` to verify (max 2 fix attempts). If validation fails, stop: "Could not generate a valid stack file for `<category>/<value>`. Create it manually using TEMPLATE.md as a guide." File an observation per `.claude/patterns/observe.md` for the missing stack file.
- Scan `src/app/` to understand the current page structure and codebase state
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

## Step 4: Check type-specific preconditions

- If `.claude/current-plan.md` exists and the current branch starts with `change/`: a previous session completed Phase 1 (plan approved) but Phase 2 was not finished. Tell the user: "Found a previously approved plan in `.claude/current-plan.md`. Resuming Phase 2 implementation on this branch. Skipping Phase 1 planning." Then skip the rest of Phase 1 and jump directly to Phase 2: Step 5.
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

Present the plan using the template for the classified type from `.claude/procedures/change-plans.md`.

### STOP. End your response here. Say:
> Does this plan look right? Reply **approve** to proceed, or tell me what to change.

DO NOT proceed to Phase 2 until the user explicitly replies with approval.
If the user requests changes instead of approving, revise the plan to address their feedback and present it again. Repeat until approved.

Save the approved plan: write the plan you presented above to `.claude/current-plan.md`. This file persists the plan across context compression and serves as the reference for verification.

---

## Phase 2: Implement (only after the user has approved)

### Step 5: Update specs (type-specific)

- **Feature**: add the new feature to experiment.yaml `features` list. Add any new pages to `pages` list. If the new feature changes the user journey (adds a page to the main flow, changes a CTA destination, or moves the value moment), update `golden_path` in experiment.yaml accordingly. If the new feature adds a webhook handler, admin action, or background job, add a corresponding entry to `critical_flows` in experiment.yaml. Do NOT remove or modify existing features or pages.
- **Upgrade**: do NOT modify experiment.yaml `features` (the feature already exists — it was listed when the Fake Door was created). Add new env vars to `.env.example`.
- **Analytics**: if the user approved custom events, add them to `custom_events` in EVENTS.yaml following the `<object>_<action>` naming convention with all properties.
- **Fix / Polish**: do NOT modify experiment.yaml or EVENTS.yaml.
- **Test**: do NOT modify EVENTS.yaml. If adding tests for the first time (no `stack.testing` in experiment.yaml and no `playwright.config.ts` on disk), add `testing: <value>` to experiment.yaml `stack` section. Do not modify other parts of experiment.yaml.

### Step 6: Make changes (type-specific)

#### Feature constraints
Follow the procedure in `.claude/procedures/change-feature.md`.

#### Upgrade constraints
Follow the procedure in `.claude/procedures/change-upgrade.md`.

#### Fix constraints
Follow the procedure in `.claude/procedures/change-fix.md`.

#### Polish constraints
- No new features, pages, routes, or libraries
- Copywriting: follow the copy derivation rules in `.claude/patterns/messaging.md` — headline = outcome for target_user, CTA = action verb + outcome. If the archetype includes a landing page (web-app): landing page must include all content inventory from messaging.md Section B. When experiment.yaml has `variants`, variant messaging fields (`headline`, `subheadline`, `cta`, `pain_points`) override Section A derivation — see messaging.md Section D.
- If the change modifies experiment.yaml `features`, `title`, or `solution` AND the archetype is service or cli AND surface ≠ none: regenerate the surface HTML to reflect the updated content (surface location: root route handler for co-located — file path per framework stack file, e.g., `src/app/route.ts` for Next.js; `site/index.html` for detached). Re-invoke `frontend-design` for the surface if the visual direction changed.
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
> Re-read `.claude/patterns/verify.md` and follow every section:
> build loop, parallel review (5 agents), security fix cycle, auto-observe.
> **Step 8 is BLOCKED until Step 7 completes.**
> Do NOT commit, push, or open a PR before verification finishes.

### Step 7: Verify
- Follow the FULL verification procedure in `.claude/patterns/verify.md`:
  1. Build & lint loop (max 3 attempts)
  2. Save notable patterns (if you fixed errors)
  3. Template observation review (ALWAYS — even if no errors were fixed)
- Re-read `.claude/current-plan.md` to verify implementation matches the approved plan. Check that every item in the plan has been addressed.
- Type-specific checks:
  - **Feature**: trace the user flow — can a user discover, use, and complete the feature? Verify all new analytics events fire.
  - **Fix**: trace the bug report's user flow through code to confirm it's fixed.
  - **Polish**: open each changed file and confirm analytics imports and event calls are intact.
  - **Analytics**: re-trace each standard funnel event through the code to confirm it now fires correctly.
  - **Production quality (if `quality: production`)**: verify.md spawns all agents (existing 5 + spec-reviewer). Pass experiment.yaml + `.claude/current-plan.md` to spec-reviewer.
  - **Test**: verify test discovery works by running the testing stack file's test command in dry-run/list mode (e.g., `npx playwright test --list` for Playwright, `npx vitest run --reporter=verbose` for Vitest). If test discovery fails, treat it as a build error — fix the test files and re-run. If still failing after the verify.md retry budget, report to the user with the error output.
  - **Feature (spec compliance)**: Re-read `.claude/current-plan.md` and `idea/experiment.yaml`. Verify implementation matches the archetype's primary units:
    - If archetype requires `pages`: confirm `src/app/<page-name>/page.tsx` exists for each page in experiment.yaml `pages`
    - If archetype requires `endpoints`: confirm API route exists for each endpoint in experiment.yaml `endpoints` (path depends on framework stack file)
    - If archetype requires `commands` (cli): confirm `src/commands/<command-name>.ts` exists for each entry in the experiment.yaml command list
    - For each feature in `features`, confirm the implementation addresses it. For each event in `EVENTS.yaml`, confirm tracking calls are intact. If anything is missing, fix it before proceeding.

### Step 8: Commit, push, open PR
- You are already on a feature branch (created in Step 0). Do not create another branch.
- Commit message: imperative mood describing the change (e.g., "Add invoice email reminders", "Fix email validation on signup form", "Polish landing copy and error states")
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md` format:
  - **Summary**: plain-English description of the change
  - **How to Test**: steps to verify the change works after merging
  - **What Changed**: list every file created/modified and what changed
  - **Why**: how this change serves the target user and primary metric. If from a GitHub issue, include `Closes #<number>`.
  - **Checklist — Scope**: check all boxes. For features: confirm experiment.yaml was updated.
  - **Checklist — Analytics**: list all new/modified events and which pages fire them. For fixes/polish: confirm no events were removed or broken.
  - **Checklist — Build**: confirm build passes, no hardcoded secrets
  - **Checklist — Verification**: fill in design-critic, ux-journeyer, and security verdicts from Step 7. If Step 7 was skipped or partially run, state why.
- Fill in **every** section of the PR template. Empty sections are not acceptable. If a section does not apply, write "N/A" with a one-line reason.
- If `git push` or `gh pr create` fails: show the error and tell the user to check their GitHub authentication (`gh auth status`) and remote configuration (`git remote -v`), then retry.
- Delete `.claude/current-plan.md` — the plan is now captured in the PR description. Note: this deletion happens AFTER Step 7 completes (spec-reviewer needs the plan during verification).
- Tell the user: "Change PR created. Next: review and merge to `main`. Run `/verify` to confirm tests pass." If the archetype is `cli`, add: "CLIs are distributed via `npm publish` or GitHub Releases — see the archetype file. After publishing and collecting usage data, run `/iterate` to review metrics, or `/retro` when ready to wrap up." Otherwise, add: "Then run `/deploy` if not yet deployed."

## Do NOT
- Add more than what `$ARGUMENTS` describes — one change per PR
- Modify existing features unless the change requires integration (e.g., adding a nav link)
- Remove or break existing analytics events (unless the change is specifically about fixing analytics)
- Add libraries not in experiment.yaml `stack` without user approval
- Skip updating experiment.yaml when adding new features — the source of truth must always reflect the current app
- Change analytics event names — they must match EVENTS.yaml
- Add custom analytics events without user approval
- Add error-state tests — funnel happy path only (Rule 4)
- Mock services in tests — the whole point is testing real integrations
- Skip Step 7 verification (verify.md must run in full — build, design-critic, security, auto-observe)
- Commit to main directly
