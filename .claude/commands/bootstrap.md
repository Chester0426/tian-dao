---
description: "Use when starting a new experiment from a filled-in idea.yaml. Run once per project."
type: code-writing
reads:
  - idea/idea.yaml
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
  - .claude/procedures/scaffold.md
  - .claude/procedures/wire.md
branch_prefix: feat
modifies_specs: false
---
Bootstrap the MVP from idea.yaml.

## Step 0: Branch Setup

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `feat` and branch name `feat/bootstrap`.

## Phase 1: Plan (BEFORE writing any code)

DO NOT write any code, create any files, or run any install commands during this phase.

1. **Read context files**
   - Read `idea/idea.yaml` — this is the single source of truth
   - Read `EVENTS.yaml` — these are the canonical analytics events to wire up
   - Read `CLAUDE.md` — these are the rules to follow

2. **Resolve the archetype and stack**
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from idea.yaml, default `web-app`). The archetype defines required idea.yaml fields, file structure, and funnel template. **If the archetype is `service`:** Steps 3-4 (app shell + pages) do not apply — skip them. Step 5 (API routes) becomes the primary implementation step. Step 7b uses the testing stack file's test runner (not necessarily Playwright). See the archetype file for full guidance. **If the archetype is `cli`:** Steps 3 (app shell/root layout), 4 (pages), and 5 (API routes) do not apply — skip them. The primary implementation is `src/index.ts` (CLI entry point with bin config) and `src/commands/` (one module per idea.yaml command). There is no HTTP server, no landing page, no UI components. Analytics uses `trackServerEvent()` from the server analytics library. Step 7b uses the testing stack file's test runner (not Playwright — no browser). See the archetype file for full guidance.
   - Read idea.yaml `stack`. For each category present in idea.yaml `stack`, read `.claude/stacks/<category>/<value>.md`. Which categories are required, optional, or excluded depends on the archetype (see the archetype file's `required_stacks`, `optional_stacks`, and `excluded_stacks` fields).
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
   - For each stack file read, validate its `assumes` entries: every `category/value` in the file's `assumes` list must match a `category: value` pair in idea.yaml `stack`. If any assumption is unmet, stop and list the incompatibilities (e.g., "analytics/posthog assumes framework/nextjs, but your stack has framework: remix"). The user must either change the mismatched stack value or create a compatible stack file.

3. **Validate idea.yaml**
   - Every one of these fields must be present and non-empty (strings must be non-blank, lists must have at least one item): `name`, `title`, `owner`, `problem`, `solution`, `target_user`, `distribution`, `features`, `primary_metric`, `target_value`, `measurement_window`, `stack`, plus fields from the archetype's `required_idea_fields` (e.g., `pages` for web-app, `endpoints` for service)
   - If ANY field still contains "TODO" or is missing: stop, list exactly which fields need to be filled in, and do nothing else
   - If the archetype requires `pages` (web-app): verify `pages` includes an entry with `name: landing`
   - If the archetype requires `endpoints` (service): verify `endpoints` is a non-empty list
   - If the archetype requires `commands` (cli): verify `commands` is a non-empty list
   - Verify `name` is lowercase with hyphens only (no spaces, no uppercase)
   - If `stack.payment` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Payment requires authentication to identify the paying user. Add `auth: supabase` (or another auth provider) to your idea.yaml `stack` section."
   - If `stack.payment` is present, verify `stack.database` is also present. If not: stop and tell the user: "Payment requires a database to record transaction state. Add `database: supabase` (or another database provider) to your idea.yaml `stack` section."
   - If `stack.email` is present, verify `stack.auth` is also present. If not: stop and tell the user: "Email requires authentication to know who to send emails to. Add `auth: supabase` (or another auth provider) to your idea.yaml `stack` section."
   - If `stack.email` is present, verify `stack.database` is also present. If not: stop and tell the user: "Email nudge requires a database to check user activation status. Add `database: supabase` (or another database provider) to your idea.yaml `stack` section."
   - If `variants` is present in idea.yaml, validate the variants list:
     - Must be a list with at least 2 entries (testing 1 variant = no variants — tell the user to remove the field)
     - Each variant must have: `slug`, `headline`, `subheadline`, `cta`, `pain_points` (all non-empty)
     - Each `slug` must be lowercase, start with a letter, and use only a-z, 0-9, hyphens
     - Slugs must be unique across all variants
     - No slug may collide with a page name from `pages`
     - `pain_points` must have exactly 3 items per variant
     - At most one variant may have `default: true`
     - If any validation fails: stop and list the specific errors

3b. **Check for duplicate experiments and update repo description**

   1. Detect the GitHub org: run `gh repo view --json owner --jq '.owner.login'`.
      If this fails (not a GitHub repo, or `gh` not authed), skip this entire step silently.

   2. Update the repo description with idea.yaml `title`:
      ```bash
      gh repo edit --description "<idea.yaml title>"
      ```
      If this fails, warn but continue — description is cosmetic.

   3. Hard check — name collision:
      Run `gh repo list <org> --json name,url --limit 200 --no-archived`.
      If any repo name exactly matches idea.yaml `name` AND is not the current repo,
      stop: "A repo named '<name>' already exists in <org>: <url>. Pick a different
      `name` in idea.yaml or confirm with the team that this is intentional."

   4. Soft check — LLM-filtered duplicate detection:
      Run `gh repo list <org> --json name,description,url --limit 200 --no-archived`.
      Exclude the current repo from the list. Review the remaining repo names and
      descriptions against the current idea.yaml (`title`, `problem`, `solution`,
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
   - Landing Page (/) — [purpose from idea.yaml]
   - [Page Name] (/route) — [purpose from idea.yaml]
   - ...

   **Features:**
   - [feature 1] → built in [file(s)]
   - [feature 2] → built in [file(s)]
   - ...

   **Variants (if idea.yaml has `variants`):**
   - [slug] — "[headline]" → /v/[slug] [default if applicable]
   - [slug] — "[headline]" → /v/[slug]
   - Root `/` renders: [default variant slug]

   **Database Tables (if any):**
   - [table name] — stores [what]
   - ...

   **External Dependencies (decided in Phase 2, Step 4b):**
   - [service] — [credentials needed] — **core** — must integrate (credentials at bootstrap or /deploy)
   - [service] — [credentials needed] — **non-core** — Fake Door (default) / Skip / Full Integration
   - ...
   - (Or: "None — all features use stack-managed services")

   Core = removing it prevents users from completing primary_metric ("[value]").

   **Analytics Events:**
   - [For each EVENTS.yaml standard_funnel event, show: event_name on Page Name]
   - [For each payment_funnel event if stack.payment present, show: event_name on page/route]

   **Activation mapping:**
   - idea.yaml primary_metric: [metric]
   - activate event action value: "[concrete_action]" (e.g., "created_invoice") — or "N/A — all features are descriptive, activate will be omitted" if no feature involves an interactive user action

   **Tests (if stack.testing present):**
   - Test runner: [testing stack value]
   - [If web-app] Template path: Full templates (all assumes met) | No-Auth Fallback (assumes unmet: [list])
   - [If web-app] Smoke tests for: [list each page name]
   - [If web-app] Funnel test: landing → [activate action] → login → [core value pages]
   - [If service] Endpoint smoke tests for: /api/health, [list each endpoint]
   - [If cli] Command smoke tests for: --version, --help, [list each command] --help

   **Questions:**
   - [any ambiguities — or "None"]
   ```

6. **STOP.** End your response here. Say:
   > Does this plan look right? Reply **approve** to proceed, or tell me what to change.

   DO NOT proceed to Phase 2 until the user explicitly replies with approval.
   If the user requests changes instead of approving, revise the plan to address their feedback and present it again. Repeat until approved.

7. **Save the approved plan.** Write the plan you presented above to `.claude/current-plan.md`. This file persists the plan across context compression and serves as the reference for checkpoint verification.

## Phase 2: Implement (only after the user has approved)

Create a team via TeamCreate with team_name: `<idea.yaml name>-bootstrap`.

### Scaffold Phase

Create a scaffold task via TaskCreate:
- subject: "Scaffold: project init, libraries, pages, landing page (Steps 1-4c)"
- description: Full scaffold instructions from `.claude/procedures/scaffold.md`

Spawn a teammate via Agent with:
- subagent_type: general-purpose
- team_name: `<team name>`
- name: "scaffold"
- prompt: Tell the teammate to:
  1. Read `.claude/procedures/scaffold.md` and execute all steps
  2. Read context files before starting: `idea/idea.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     all `.claude/stacks/<category>/<value>.md` for categories in idea.yaml `stack`,
     `.claude/stacks/surface/<value>.md` (resolved from idea.yaml or inferred),
     `.claude/patterns/design.md`, `.claude/patterns/messaging.md`
  3. Follow CLAUDE.md Rules 3, 4, 6, 7, 9, 10, 12
  4. On completion: mark the scaffold task completed via TaskUpdate, then send
     the completion report (as defined in scaffold.md) to the lead via SendMessage

**Do NOT assemble file contents into the prompt.** Teammates are independent
Claude Code sessions with full file access — they read files themselves. The
prompt tells them WHICH files to read and WHAT to do.

**After the scaffold teammate reports completion:**

Run semantic validation — these checks catch issues that `npm run build` misses:

1. **Page/endpoint/command existence:**
   - If archetype is `web-app`: for each page in idea.yaml `pages`, verify
     `src/app/<page-name>/page.tsx` exists (or root page for `landing`)
   - If archetype is `service`: for each endpoint in idea.yaml `endpoints`,
     verify the handler file exists at the path defined by the framework stack file
   - If archetype is `cli`: for each command in idea.yaml `commands`, verify
     `src/commands/<command-name>.ts` exists
2. **Analytics wiring** (if `stack.analytics` is present): for each
   standard_funnel event in EVENTS.yaml, grep for the event name in `src/`
   to confirm a tracking call exists
3. **Design tokens** (if archetype is `web-app`): verify `src/app/globals.css`
   contains a non-empty `--primary` custom property
4. **Build**: run `npm run build` — the project must compile
5. If any check fails: send a message to the scaffold teammate with the specific
   failures and ask it to fix them. Re-validate after the fix.

If validation passes, proceed to the wire phase.

### Wire Phase

Create a wire task via TaskCreate:
- subject: "Wire: API routes, DB schema, tests, verify, PR (Steps 5-9)"
- description: Full wire instructions from `.claude/procedures/wire.md`

Spawn a teammate via Agent with:
- subagent_type: general-purpose
- team_name: `<team name>`
- name: "wire"
- prompt: Tell the teammate to:
  1. Read `.claude/procedures/wire.md` and execute all steps
  2. Read context files before starting: `idea/idea.yaml`, `EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     all `.claude/stacks/<category>/<value>.md` for categories in idea.yaml `stack`,
     `.claude/patterns/verify.md`, `.claude/patterns/visual-review.md`,
     `.claude/patterns/security-review.md`, `.claude/patterns/observe.md`,
     `.github/PULL_REQUEST_TEMPLATE.md`
  3. Include the scaffold teammate's completion report (external dep decisions,
     generated files, env vars) in the prompt so the wire teammate has context
  4. Follow CLAUDE.md Rules 1, 4, 5, 6, 7, 8, 10, 12
  5. On completion: mark the wire task completed via TaskUpdate, then send
     the PR URL to the lead via SendMessage

### Teardown

After the wire teammate returns the PR URL:
1. Send shutdown_request to the scaffold teammate
2. Send shutdown_request to the wire teammate
3. Call TeamDelete to clean up the team
4. Report the PR URL to the user
