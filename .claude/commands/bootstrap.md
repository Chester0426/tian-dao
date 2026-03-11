---
description: "Use when starting a new experiment from a filled-in experiment.yaml. Run once per project."
type: code-writing
reads:
  - experiment/experiment.yaml
  - EVENTS.yaml
  - CLAUDE.md
stack_categories: [framework, database, auth, analytics, ui, payment, email, hosting, testing]
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
  - .claude/patterns/messaging.md
  - .claude/patterns/design.md
  - .claude/procedures/scaffold-setup.md
  - .claude/procedures/scaffold-init.md
  - .claude/procedures/scaffold-libs.md
  - .claude/procedures/scaffold-pages.md
  - .claude/procedures/scaffold-externals.md
  - .claude/procedures/scaffold-landing.md
  - .claude/procedures/wire.md
branch_prefix: feat
modifies_specs: false
---
Bootstrap the MVP from experiment.yaml.

## Step 0: Branch Setup

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `feat` and branch name `feat/bootstrap`.

> **If resuming from a failed bootstrap:** see `.claude/patterns/recovery.md` for recovery options.

## Phase 1: Plan (BEFORE writing any code)

DO NOT write any code, create any files, or run any install commands during this phase.

1. **Read context files**
   - Read `experiment/experiment.yaml` — this is the single source of truth
   - Read `EVENTS.yaml` — these are the canonical analytics events to wire up
   - Read `CLAUDE.md` — these are the rules to follow

2. **Resolve the archetype and stack**
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`). The archetype defines required experiment.yaml fields, file structure, and funnel template. **If the archetype is `service`:** Steps 3-4 (app shell + pages) do not apply — skip them. Step 5 (API routes) becomes the primary implementation step. Step 7b uses the testing stack file's test runner (not necessarily Playwright). See the archetype file for full guidance. **If the archetype is `cli`:** Steps 3 (app shell/root layout), 4 (pages), and 5 (API routes) do not apply — skip them. The primary implementation is `src/index.ts` (CLI entry point with bin config) and `src/commands/` (one module per experiment.yaml command). There is no HTTP server, no landing page, no UI components. Analytics uses `trackServerEvent()` from the server analytics library. Step 7b uses the testing stack file's test runner (not Playwright — no browser). See the archetype file for full guidance.
   - Read experiment.yaml `stack`. For each category present in experiment.yaml `stack`, read `.claude/stacks/<category>/<value>.md`. Which categories are required, optional, or excluded depends on the archetype (see the archetype file's `required_stacks`, `optional_stacks`, and `excluded_stacks` fields).
   - If a stack file doesn't exist for a given value:
     1. Read `.claude/stacks/TEMPLATE.md` for the required frontmatter schema.
     2. Read existing stack files in the same category (`.claude/stacks/<category>/*.md`) as reference for conventions and structure. If no files exist in that category, read a well-populated stack file from another category (e.g., `database/supabase.md` or `analytics/posthog.md`) as a structural reference.
     3. Generate `.claude/stacks/<category>/<value>.md` with:
        - Complete frontmatter (assumes, packages, files, env, ci_placeholders, clean, gitignore) — populate each field based on knowledge of the technology. Use empty lists/dicts for fields that genuinely don't apply.
        - Code templates for library files and route handlers using `### \`path\`` heading format.
        - Environment Variables, Packages, and Patterns sections following the TEMPLATE.md structure.
     4. Run `python3 scripts/validate-frontmatter.py` to verify the generated file passes structural checks. If it fails, fix the frontmatter and re-run (max 2 attempts). If still failing, stop and tell the user: "Could not generate a valid stack file for `<category>/<value>`. Create `.claude/stacks/<category>/<value>.md` manually using TEMPLATE.md as a guide, then re-run `/bootstrap`."
     5. Tell the user: "Generated `.claude/stacks/<category>/<value>.md` — this is auto-generated from Claude's knowledge and has not been team-reviewed. Review it after bootstrap completes."
     6. File an observation per `.claude/patterns/observe.md` noting the missing stack file, so the template repo can add a reviewed version.
     7. Continue bootstrap using the generated stack file.
   - These files define packages, library files, env vars, and patterns for each technology.
   - For each stack file read, validate its `assumes` entries: every `category/value` in the file's `assumes` list must match a `category: value` pair in experiment.yaml `stack`. If any assumption is unmet, stop and list the incompatibilities (e.g., "analytics/posthog assumes framework/nextjs, but your stack has framework: remix"). The user must either change the mismatched stack value or create a compatible stack file.

3. **Validate experiment.yaml**
   - Every one of these fields must be present and non-empty (strings must be non-blank, lists must have at least one item): `name`, `type`, `description`, `thesis`, `target_user`, `distribution`, `behaviors`, `stack`, plus fields from the archetype's `required_idea_fields` (e.g., `golden_path` for web-app, `endpoints` for service)
   - If ANY field still contains "TODO" or is missing: stop, list exactly which fields need to be filled in, and do nothing else
   - If the archetype requires pages (web-app): verify `golden_path` includes at least one entry with `page: landing`
   - If the archetype requires `endpoints` (service): verify `endpoints` is a non-empty list
   - If the archetype requires `commands` (cli): verify `commands` is a non-empty list
   - Verify `name` is lowercase with hyphens only (no spaces, no uppercase)
   - For each category in the archetype's `excluded_stacks` list: if that category is present in experiment.yaml `stack`, stop and tell the user: "The `<archetype>` archetype excludes `<category>`. Remove `<category>: <value>` from your experiment.yaml `stack` section, or switch to a different archetype."
   - If `stack.payment` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Payment requires authentication to identify the paying user. Add `auth: supabase` (or another auth provider) to your experiment.yaml `stack` section."
   - If `stack.payment` is present, verify `stack.database` is also present. If not: stop and tell the user: "Payment requires a database to record transaction state. Add `database: supabase` (or another database provider) to your experiment.yaml `stack` section."
   - If `stack.email` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Email requires authentication to know who to send emails to. Add `auth: supabase` (or another auth provider) to your experiment.yaml `stack` section."
   - If `stack.email` is present, verify `stack.database` is also present. If not: stop and tell the user: "Email nudge requires a database to check user activation status. Add `database: supabase` (or another database provider) to your experiment.yaml `stack` section."
   - If `stack.testing` is `playwright` and archetype is `service` or `cli`: stop and tell the user: "Playwright requires a browser and is not compatible with the `<archetype>` archetype. Use `testing: vitest` (or another server-side test runner) instead."
   - If `quality: production` is set in experiment.yaml: verify `stack.testing` is present. If absent: stop — "Production quality requires a testing framework. Add `testing: playwright` (web-app) or `testing: vitest` (service/cli) to experiment.yaml `stack`."
   - If `stack.auth_providers` is present:
     - Verify `stack.auth` is also present. If not: stop — "OAuth providers require an auth system. Add `auth: supabase` to your experiment.yaml `stack` section."
     - Verify it is a non-empty list of strings. If empty: stop — "auth_providers is empty. Either add providers (e.g., `[google, github]`) or remove the field."
     - Warn (don't stop) for unrecognized slugs — Supabase may add new providers.
   - If `variants` is present in experiment.yaml, validate the variants list:
     - Must be a list with at least 2 entries (testing 1 variant = no variants — tell the user to remove the field)
     - Each variant must have: `slug`, `headline`, `subheadline`, `cta`, `pain_points` (all non-empty)
     - Each `slug` must be lowercase, start with a letter, and use only a-z, 0-9, hyphens
     - Slugs must be unique across all variants
     - No slug may collide with a page name from `golden_path`
     - `pain_points` must have exactly 3 items per variant
     - If any validation fails: stop and list the specific errors

3b. **Check for duplicate experiments and update repo description**

   1. Detect the GitHub org: run `gh repo view --json owner --jq '.owner.login'`.
      If this fails (not a GitHub repo, or `gh` not authed), skip this entire step silently.

   2. Update the repo description with experiment.yaml `name` and `description` (first line):
      ```bash
      gh repo edit --description "<experiment.yaml name>: <first line of description>"
      ```
      If this fails, warn but continue — description is cosmetic.

   3. Hard check — name collision:
      Run `gh repo list <org> --json name,url --limit 200 --no-archived`.
      If any repo name exactly matches experiment.yaml `name` AND is not the current repo,
      stop: "A repo named '<name>' already exists in <org>: <url>. Pick a different
      `name` in experiment.yaml or confirm with the team that this is intentional."

   4. Soft check — LLM-filtered duplicate detection:
      Run `gh repo list <org> --json name,description,url --limit 200 --no-archived`.
      Exclude the current repo from the list. Review the remaining repo names and
      descriptions against the current experiment.yaml (`name`, `description`,
      `target_user`). Identify repos that appear to solve a substantially similar
      problem for a similar audience.

      If no suspicious matches → proceed silently.

      If suspicious matches found → present them:

      > **Potential overlaps detected.** These existing experiments may overlap with yours:
      >
      > | Repo | Description | Link |
      > |------|-------------|------|
      > | ... | ... | https://github.com/\<org\>/... |
      >
      > **Why these flagged:** [1-sentence reason per repo]
      >
      > If these are intentionally different (different audience, angle, or distribution),
      > proceed. If this is an accidental duplicate, stop and coordinate with the team.

      Wait for user confirmation before proceeding.

4. **Check preconditions**
   - If `.claude/current-plan.md` exists and the current branch starts with `feat/bootstrap`: a previous session completed Phase 1 (plan approved) but Phase 2 was not finished. Tell the user: "Found a previously approved plan in `.claude/current-plan.md`. Resuming Phase 2 implementation on this branch. Skipping Phase 1 planning." Then skip the rest of Phase 1 and jump directly to Phase 2: Step 1.
   - If `package.json` exists AND the `src/` directory contains application files (check for any `.ts` or `.tsx` files): stop and tell the user: "This project has already been bootstrapped. Use `/change ...` to make changes, or run `make clean` to start over."
   - If `package.json` exists but the `src/` directory does NOT contain application files: warn the user: "A previous bootstrap may have partially completed. I'll continue from the beginning — packages may be reinstalled." Note: the branch name `feat/bootstrap` may already exist from the previous attempt. If so, this run will use `feat/bootstrap-2` — you can delete the old branch later with `git branch -d feat/bootstrap`. Then proceed.

5. **Present the plan** in plain language the user can verify:

   ```
   ## What I'll Build

   **Pages:**
   - Landing Page (/) — [purpose from experiment.yaml]
   - [Page Name] (/route) — [purpose from experiment.yaml]
   - ...

   **Behaviors:**
   - [b-NN: behavior description] → built in [file(s)]
   - [b-NN: behavior description] → built in [file(s)]
   - ...

   **Variants (if experiment.yaml has `variants`):**
   - [slug] — "[headline]" → /v/[slug]
   - [slug] — "[headline]" → /v/[slug]
   - Root `/` renders: [first variant slug]

   **Database Tables (if any):**
   - [table name] — stores [what]
   - ...

   **External Dependencies (decided in Phase 2, Step 4b):**
   - [service] — [credentials needed] — **core** — must integrate (credentials at bootstrap or /deploy)
   - [service] — [credentials needed] — **non-core** — Fake Door (default) / Skip / Full Integration
   - ...
   - (Or: "None — all features use stack-managed services")

   Core = removing it prevents users from validating the thesis.

   **Analytics Events:**
   - [For each EVENTS.yaml standard_funnel event, show: event_name on Page Name]
   - [For each payment_funnel event if stack.payment present, show: event_name on page/route]

   **Golden Path (from experiment.yaml):**
   | Step | Page | Event |
   |------|------|-------|
   | 1. [step] | [page] | [event] |
   Target: [target_clicks] clicks

   If experiment.yaml has no `golden_path` field: derive one from behaviors + EVENTS.yaml standard_funnel,
   present it in the plan, and write it back to experiment.yaml after approval (Step 7).

   **System/Cron Behaviors (from experiment.yaml):**
   | Behavior | Actor | Trigger | Then |
   |----------|-------|---------|------|
   | [b-NN] | [actor] | [trigger] | [then] |

   If no behaviors have `actor: system` or `actor: cron`: "None defined — all behaviors are user-initiated."

   **Activation mapping:**
   - experiment.yaml thesis: [thesis]
   - activate event action value: "[concrete_action]" (e.g., "created_invoice") — or "N/A — all behaviors are descriptive, activate will be omitted" if no behavior involves an interactive user action

   **Tests (if stack.testing present):**
   - Test runner: [testing stack value]
   - [If web-app] Template path: Full templates (all assumes met) | No-Auth Fallback (assumes unmet: [list])
   - [If web-app] Smoke tests for: [list each page name]
   - [If web-app] Funnel test: landing → [activate action] → login → [core value pages]
   - [If service] Endpoint smoke tests for: /api/health, [list each endpoint]
   - [If cli] Command smoke tests for: --version, --help, [list each command] --help

   **Technical Decisions:**
   - Data model: [for each table — key columns, relationships, RLS approach]
   - API patterns: [REST conventions, error shape, pagination approach if applicable]
   - Auth flow: [if stack.auth present — signup → verify → session approach]
   - State management: [client-side approach — server components vs client state]
   - (Or: "Standard defaults — no notable architectural decisions for this MVP")

   **Questions:**
   - [any ambiguities — or "None"]
   ```

6. **STOP.** End your response here. Say:
   > Does this plan look right? Reply **approve** to proceed, or tell me what to change.

   DO NOT proceed to Phase 2 until the user explicitly replies with approval.
   If the user requests changes instead of approving, revise the plan to address their feedback and present it again. Repeat until approved.

7. **Save the approved plan.** Write the plan you presented above to `.claude/current-plan.md`. This file persists the plan across context compression and serves as the reference for checkpoint verification. If `golden_path` was derived (not already in experiment.yaml), write it back to `experiment/experiment.yaml` after approval.

## Phase 2: Implement (only after the user has approved)

**Do NOT assemble file contents into the prompt.** Subagents are independent
Claude Code sessions with full file access — they read files themselves. The
prompt tells them WHICH files to read and WHAT to do.

### Preamble: Pre-flight checks

Before spawning any subagents, the lead performs user-interactive checks:

1. **Production quality check**: If `quality: production` is set in experiment.yaml, pass this flag to each scaffold-* agent prompt: "quality: production is set. Generate tests alongside each file you create." Agent test ownership:
   - scaffold-setup: create testing config (playwright.config.ts or vitest.config.ts)
   - scaffold-libs: generate unit tests for utility functions alongside library code
   - scaffold-pages: generate page-load smoke tests (same as MVP, but more thorough)
   - scaffold-wire: run test discovery checkpoint (`npx playwright test --list` or vitest equivalent)

2. **TSP-LSP check**: Run `which typescript-language-server`. If found, record
   `tsp_status: "available"`. If not found, tell the user:
   > `typescript-language-server` is not installed globally. It gives subagents
   > real-time type checking during code generation. Install with:
   > `npm install -g typescript-language-server typescript`
   > Say "skip" to proceed without it.
   Wait for the user to confirm installation or say "skip". If confirmed,
   re-check with `which typescript-language-server`. Record `tsp_status`
   as `"available"` or `"skipped"`.

This value is passed to subagents in their prompts (subagents cannot
interact with users).

### Setup Phase

Spawn a subagent via Agent with:
- subagent_type: scaffold-setup
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-setup.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, all `.claude/stacks/<category>/<value>.md`
     for categories in experiment.yaml `stack`, `.claude/archetypes/<type>.md`
  3. TSP-LSP status: `<tsp_status from preamble>`
  4. Follow CLAUDE.md Rules 3, 4, 6, 7, 9

Wait for setup to complete before proceeding.

Run `npm audit --audit-level=critical`. If critical vulnerabilities are found, warn:
> "Critical npm vulnerabilities detected. Run `npm audit fix` after bootstrap completes."
Continue regardless — this is non-blocking during bootstrap.

### Design Phase

Spawn a subagent via Agent with:
- subagent_type: scaffold-init
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-init.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, `.claude/current-plan.md`,
     `.claude/patterns/design.md`, `.claude/archetypes/<type>.md`,
     `.claude/stacks/surface/<value>.md` (resolved from experiment.yaml or inferred)
  3. Follow CLAUDE.md Rules 3, 4, 7

The subagent returns its completion report directly as the result.
Wait for design to complete before proceeding.

### Parallel Scaffold Phase

Spawn four subagents simultaneously using parallel Agent tool calls (three if surface = none):

**Libs subagent:**
- subagent_type: scaffold-libs
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-libs.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, all stack files
  3. Follow CLAUDE.md Rules 3, 4, 6, 7

**Pages subagent:**
- subagent_type: scaffold-pages
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-pages.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, archetype file,
     framework/UI stack files, `.claude/patterns/design.md`,
     `.claude/current-visual-brief.md`
  3. Follow CLAUDE.md Rules 3, 4, 6, 7, 9

**Externals subagent (analysis only):**
- subagent_type: scaffold-externals
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-externals.md` and execute the
     analysis steps (evaluate dependencies, classify core/non-core)
  2. Read context files: `experiment/experiment.yaml`, `.claude/current-plan.md`,
     `.claude/stacks/TEMPLATE.md`, existing stack files
  3. Follow CLAUDE.md Rules 3, 4, 6
  4. Return the classification table and Fake Door list — do NOT collect
     credentials or write env vars (the lead handles those)

**Landing subagent (if surface ≠ none):**
- subagent_type: scaffold-landing
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-landing.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     framework/UI/surface stack files,
     `.claude/patterns/design.md`, `.claude/patterns/messaging.md`,
     `.claude/current-visual-brief.md`,
     `src/app/globals.css` (theme tokens from init phase)
  3. Follow CLAUDE.md Rules 3, 4, 6, 7, 9

### Externals: User Decisions + Execution

After the externals subagent returns its classification table:

1. **Present classification to user**: show the core/non-core table and
   collect decisions (Fake Door / Skip / Full Integration / Provide now /
   Provision at deploy) for each dependency.
2. **Collect credentials**: for "Provide now" choices, ask the user for
   credential values.
3. **Execute remaining work**: generate external stack files (per
   scaffold-externals.md Steps 6-8), write env vars to `.env.local` and
   `.env.example`, create Fake Door entries.

If the externals subagent reported "No external dependencies", skip this
section entirely.

### Fake Door Integration

If the externals analysis reported Fake Door features, the bootstrap lead
creates them directly:

For each Fake Door feature, generate a component in the page folder where the
feature would naturally appear (e.g., `src/app/dashboard/sms-fake-door.tsx`):
- Real, polished UI using shadcn components (Card + Button + Dialog), following `.claude/patterns/design.md`
- On button click: `track("activate", { action: "[feature-name]", fake_door: true })`
- Shows a Dialog: "[Feature Name] is coming soon — we're building this now."
- Import and render the Fake Door component in the parent page where the feature would naturally live
- The component should look like a real feature entry point — not a placeholder or disabled button

### Merged Checkpoint + Semantic Validation

Run combined verification after all four parallel subagents complete — these checks catch compilation and semantic issues:

1. **Build**: run `npm run build` — the project must compile
2. **Page/endpoint/command existence:**
   - If archetype is `web-app`: for each unique page referenced in experiment.yaml `golden_path`,
     verify `src/app/<page-name>/page.tsx` exists (or root page for `landing`).
     If surface ≠ none: verify landing page file exists (`src/app/page.tsx`
     or `src/components/landing-content.tsx` for variants)
   - If archetype is `service`: for each endpoint in experiment.yaml `endpoints`,
     verify the handler file exists at the path defined by the framework stack file
   - If archetype is `cli`: for each command in experiment.yaml `commands`, verify
     `src/commands/<command-name>.ts` exists
3. **Analytics wiring** (if `stack.analytics` is present): for each
   standard_funnel event in EVENTS.yaml, grep for the event name in `src/`
   to confirm a tracking call exists. Also verify analytics constants:
   grep `src/lib/analytics*.ts` for `PROJECT_NAME` —
   it must equal the actual experiment.yaml `name` value, not
   a `"TODO"` string
4. **Design tokens** (if archetype is `web-app`): verify `src/app/globals.css`
   contains a non-empty `--primary` custom property

If any check fails: the bootstrap lead fixes directly (it has full file access
as coordinator). Re-run `npm run build` after fixes. Budget: 2 fix attempts.
If still failing after 2 attempts: defer to lead's verify phase after wire
completes.

### Wire Phase

Spawn a subagent via Agent with:
- subagent_type: scaffold-wire
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/wire.md` and execute Steps 5 through 8b ONLY.
     Do NOT run Step 8 (verify.md) or Step 9 (PR).
  2. Read context files before starting: `experiment/experiment.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     all `.claude/stacks/<category>/<value>.md` for categories in experiment.yaml `stack`,
     `.claude/patterns/visual-review.md`,
     `.claude/patterns/security-review.md`,
     `.github/PULL_REQUEST_TEMPLATE.md`
  3. Include the completion reports from init, libs, pages, landing, and
     externals subagents (external dep decisions, generated files, env vars)
     in the prompt so the wire subagent has context
  4. Follow CLAUDE.md Rules 1, 4, 5, 6, 7, 8, 10, 12

### Verify Phase

After the wire subagent completes, the lead runs verify.md directly.
The lead has the Agent tool, which is required to spawn the parallel
review subagents (design-critic, security-defender, security-attacker).

Follow the FULL verification procedure in `.claude/patterns/verify.md`:
1. Build & lint loop (max 3 attempts)
2. Save notable patterns (if you fixed errors)
3. Template observation review (ALWAYS — even if no errors were fixed)

### Commit, Push, Open PR

The lead executes wire.md Step 9 directly:
- Stage all new files and commit: "Bootstrap MVP scaffold from experiment.yaml"
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md` format
- Include completion reports from all subagents for PR body context
- Delete `.claude/current-plan.md` and `.claude/current-visual-brief.md`
- Report the PR URL to the user

If `quality: production` is set in experiment.yaml, add to the user message:
> "Bootstrap complete with production quality mode. Run `/harden` to add TDD coverage to critical paths (auth, payment, data persistence)."
