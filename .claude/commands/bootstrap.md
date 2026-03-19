---
description: "Use when starting a new experiment from a filled-in experiment.yaml. Run once per project."
type: code-writing
reads:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
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

## State Index

| State | Name | Phase | Key Gate |
|-------|------|-------|----------|
| 0 | BRANCH_SETUP | Plan | — |
| 1 | READ_CONTEXT | Plan | — |
| 2 | RESOLVE_ARCHETYPE_STACK | Plan | — |
| 3 | VALIDATE_EXPERIMENT | Plan | — |
| 3a | BG1_GATE | Plan | BG1 |
| 3b | DUPLICATE_CHECK | Plan | — |
| 4 | CHECK_PRECONDITIONS | Plan | — |
| 5 | PRESENT_PLAN | Plan | — |
| 6 | USER_APPROVAL | Plan | — |
| 7 | SAVE_PLAN | Plan | — |
| 8 | PREFLIGHT | Implement | — |
| 9 | SETUP_PHASE | Implement | — |
| 10 | DESIGN_PHASE | Implement | — |
| 11 | PARALLEL_SCAFFOLD | Implement | — |
| 12 | EXTERNALS_DECISIONS | Implement | BG2.5 |
| 13 | MERGED_VALIDATION | Implement | BG2 |
| 14 | WIRE_PHASE | Implement | — |
| 15 | COMMIT_AND_PUSH | Implement | BG4 |

---

## STATE 0: BRANCH_SETUP

**PRECONDITIONS**
- Git repository exists in working directory
- Current branch is `main` (or resuming on existing `feat/bootstrap*` branch)

**ACTIONS**

Follow the branch setup procedure in `.claude/patterns/branch.md`. Use branch prefix `feat` and branch name `feat/bootstrap`.

Clean up stale artifacts from prior runs:
- `rm -rf .claude/gate-verdicts/ externals-decisions.json`

> **If resuming from a failed bootstrap:** see `.claude/patterns/recovery.md` for recovery options.

**POSTCONDITIONS**
- Current branch is `feat/bootstrap` (or `feat/bootstrap-N` if prior branch exists)
- Branch is not `main`

**VERIFY**
- `git branch --show-current` returns `feat/bootstrap*`

**NEXT** -> STATE 1

---

## STATE 1: READ_CONTEXT

**PRECONDITIONS**
- On `feat/bootstrap*` branch (STATE 0 POSTCONDITIONS met)

**ACTIONS**

DO NOT write any code, create any files, or run any install commands during States 1-7.

Read these two context files:
- Read `experiment/experiment.yaml` — this is the single source of truth
- Read `experiment/EVENTS.yaml` — these are the canonical analytics events to wire up

**POSTCONDITIONS**
- Both files have been read: `experiment/experiment.yaml`, `experiment/EVENTS.yaml`
- Their contents are in context for subsequent states

**VERIFY**
- Both files exist: `test -f experiment/experiment.yaml && test -f experiment/EVENTS.yaml`

**NEXT** -> STATE 2

---

## STATE 2: RESOLVE_ARCHETYPE_STACK

**PRECONDITIONS**
- Context files read (STATE 1 POSTCONDITIONS met)
- `experiment/experiment.yaml` content is in context

**ACTIONS**

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

**POSTCONDITIONS**
- Archetype file read and type recorded
- All stack files for categories in experiment.yaml `stack` exist and have been read
- All `assumes` entries validated — no incompatibilities

**VERIFY**
- Glob `.claude/stacks/**/*.md` returns a file for each category in experiment.yaml `stack`
- Archetype file `.claude/archetypes/<type>.md` exists

**NEXT** -> STATE 3

---

## STATE 3: VALIDATE_EXPERIMENT

**PRECONDITIONS**
- Archetype and stack resolved (STATE 2 POSTCONDITIONS met)
- All stack files and archetype file are in context

**ACTIONS**

- Every one of these fields must be present and non-empty (strings must be non-blank, lists must have at least one item): `name`, `owner`, `type`, `description`, `thesis`, `target_user`, `distribution`, `behaviors`, `stack`, plus fields from the archetype's `required_experiment_fields` (e.g., `golden_path` for web-app, `endpoints` for service)
- If ANY field still contains "TODO" or is missing: stop, list exactly which fields need to be filled in, and do nothing else
- If the archetype requires pages (web-app): verify `golden_path` includes at least one entry with `page: landing`
- If the archetype requires `endpoints` (service): verify `endpoints` is a non-empty list
- If the archetype requires `commands` (cli): verify `commands` is a non-empty list
- Verify `name` is lowercase with hyphens only (no spaces, no uppercase)
- For each category in the archetype's `excluded_stacks` list: if that category is present in experiment.yaml `stack`, stop and tell the user: "The `<archetype>` archetype excludes `<category>`. Remove `<category>: <value>` from your experiment.yaml `stack` section, or switch to a different archetype."
- For each category in the archetype's `required_stacks` list: verify the category is present in experiment.yaml `stack`. Per-service categories (`framework`, `hosting`, `ui`, `testing`) map to `stack.services[]` keys (`runtime` for framework, others by name). Shared categories (`database`, `auth`, `analytics`, `payment`, `email`) map to `stack.<category>`. If a required category is missing, stop and tell the user: "The `<archetype>` archetype requires `<category>`. Add the corresponding key to your experiment.yaml `stack` section (e.g., `hosting: vercel` or `runtime: nextjs`)."
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
- If `variants` is present in experiment.yaml and the archetype is NOT `web-app`: stop — "Variants (A/B landing page testing) are only supported for the web-app archetype. Remove the `variants` field from experiment.yaml, or switch to `type: web-app`."
- If `variants` is present in experiment.yaml, validate the variants list:
  - Must be a list with at least 2 entries (testing 1 variant = no variants — tell the user to remove the field)
  - Each variant must have: `slug`, `headline`, `subheadline`, `cta`, `pain_points` (all non-empty)
  - Each `slug` must be lowercase, start with a letter, and use only a-z, 0-9, hyphens
  - Slugs must be unique across all variants
  - No slug may collide with a page name from `golden_path`
  - `pain_points` must have exactly 3 items per variant
  - If any validation fails: stop and list the specific errors

**POSTCONDITIONS**
- All required fields present and non-empty
- `name` matches `^[a-z][a-z0-9-]*$`
- No TODO values remain
- Archetype-specific fields validated
- Stack dependency rules satisfied (payment→auth+db, email→auth+db)
- Quality/testing dependency satisfied if applicable
- Variant structure valid if applicable

**VERIFY**
- Validation is the verify — each check above is a pass/fail assertion. All must pass.

**NEXT** -> STATE 3a

---

## STATE 3a: BG1_GATE

**PRECONDITIONS**
- All validations pass (STATE 3 POSTCONDITIONS met)

**ACTIONS**

Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG1 Validation Gate. Read experiment/experiment.yaml and verify: all required fields present and non-empty, name is lowercase-hyphen, no TODO values, archetype-specific field present, stack dependency rules (payment→auth+db, email→auth+db), quality:production→testing, variants restricted to web-app archetype, variants structure if present."

If gate-keeper returns BLOCK, stop and report — do NOT proceed until validation passes.

**POSTCONDITIONS**
- BG1 Validation Gate verdict is PASS

**VERIFY**
- Gate-keeper returned `**Verdict: PASS**`

**NEXT** -> STATE 3b

---

## STATE 3b: DUPLICATE_CHECK

**PRECONDITIONS**
- BG1 PASS (STATE 3a POSTCONDITIONS met)

**ACTIONS**

1. Detect the GitHub org: run `gh repo view --json owner --jq '.owner.login'`.
   If this fails (not a GitHub repo, or `gh` not authed), skip this entire state silently.

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

**POSTCONDITIONS**
- No name collision found, OR user confirmed intentional overlap
- Repo description updated (or skipped if gh unavailable)

**VERIFY**
- `gh repo list` check completed (or skipped if gh unavailable)

**NEXT** -> STATE 4

---

## STATE 4: CHECK_PRECONDITIONS

**PRECONDITIONS**
- Duplicate check resolved (STATE 3b POSTCONDITIONS met)

**ACTIONS**

- If `.claude/current-plan.md` exists and the current branch starts with `feat/bootstrap`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `archetype`, `stack`, and `checkpoint` from frontmatter
     - Use these values directly — do NOT re-resolve archetype or stack
     - Read archetype file and stack files using frontmatter values
     - Read all files listed in `context_files` to restore source-of-truth context (experiment.yaml, experiment/EVENTS.yaml, etc.). If a listed file no longer exists, skip it and warn the user.
     - Resume at the phase indicated by `checkpoint`:
       - `phase2-setup` → **jump to STATE 9**
       - `phase2-design` → **jump to STATE 10** (setup done)
       - `phase2-scaffold` → **jump to STATE 11** (design done)
       - `phase2-wire` → **jump to STATE 14** (scaffold done)
       - `awaiting-verify` → **TERMINAL**. Bootstrap complete. Run `/verify` to validate and create PR.
     - Tell user: "Resuming bootstrap from [checkpoint]. Archetype: [archetype]."
  2. If no frontmatter (old format): fall back to current behavior — skip States 1-7, jump to STATE 8.
- If `package.json` exists AND `src/app/` contains page or route entry points:
  VERIFY: `find src/app -name 'page.tsx' -o -name 'route.ts' 2>/dev/null | head -1`
  If output is non-empty: stop and tell the user: "This project has already been bootstrapped. Use `/change ...` to make changes, or run `make clean` to start over."
- If `package.json` exists but the `src/` directory does NOT contain application files: warn the user: "A previous bootstrap may have partially completed. I'll continue from the beginning — packages may be reinstalled." Note: the branch name `feat/bootstrap` may already exist from the previous attempt. If so, this run will use `feat/bootstrap-2` — you can delete the old branch later with `git branch -d feat/bootstrap`. Then proceed.

**POSTCONDITIONS**
- Decision made: fresh start, resume at specific state, or stop (already bootstrapped)
- If resuming: archetype, stack, and checkpoint restored from frontmatter

**VERIFY**
- For fresh start: no `current-plan.md` or no `src/*.ts` files
- For resume: `checkpoint` value extracted and matched to a valid state

**NEXT** -> STATE 5 (fresh) | STATE 9/10/11/14 (resume) | TERMINAL (awaiting-verify)

---

## STATE 5: PRESENT_PLAN

**PRECONDITIONS**
- Preconditions checked, fresh start path (STATE 4 POSTCONDITIONS met, not resuming)

**ACTIONS**

Present the plan in plain language the user can verify:

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

**External Dependencies (decided in STATE 12):**
- [service] — [credentials needed] — **core** — must integrate (credentials at bootstrap or /deploy)
- [service] — [credentials needed] — **non-core** — Fake Door (default) / Skip / Full Integration
- ...
- (Or: "None — all features use stack-managed services")

Core = removing it prevents users from validating the thesis.

**Analytics Events:**
- [For each event in experiment/EVENTS.yaml events map (filtered by requires/archetypes), show: event_name on Page Name]

**Golden Path (from experiment.yaml):**
| Step | Page | Event |
|------|------|-------|
| 1. [step] | [page] | [event] |
Target: [target_clicks] clicks

If experiment.yaml has no `golden_path` field: derive one from behaviors + experiment/EVENTS.yaml events map,
present it in the plan, and write it back to experiment.yaml after approval (STATE 7).

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

**POSTCONDITIONS**
- Plan displayed to user with all required sections

**VERIFY**
- Plan output contains all required sections: Pages, Behaviors, Analytics Events, Golden Path, Technical Decisions

**NEXT** -> STATE 6

---

## STATE 6: USER_APPROVAL

**PRECONDITIONS**
- Plan presented (STATE 5 POSTCONDITIONS met)

**ACTIONS**

**STOP.** End your response here. Say:
> Plan ready. How would you like to proceed?
> 1. **approve** — continue implementation now
> 2. **approve and clear** — save plan, then clear context for a fresh start
> 3. Or tell me what to change

DO NOT proceed to STATE 7 until the user explicitly replies with approval.
If the user requests changes instead of approving, revise the plan to address their feedback and present it again (return to STATE 5). Repeat until approved.

**POSTCONDITIONS**
- User has explicitly approved the plan (option 1 or 2)

**VERIFY**
- User message contains approval (e.g., "approve", "1", "2", "approve and clear", "looks good", "proceed")

**NEXT** -> STATE 7

---

## STATE 7: SAVE_PLAN

**PRECONDITIONS**
- User approved the plan (STATE 6 POSTCONDITIONS met)

**ACTIONS**

Write the plan to `.claude/current-plan.md` with YAML frontmatter:

```yaml
---
skill: bootstrap
archetype: [from experiment.yaml type, default web-app]
branch: feat/bootstrap
stack: { [category]: [value], ... }
checkpoint: phase2-setup
context_files:
  - experiment/experiment.yaml
  - experiment/EVENTS.yaml
  - .claude/archetypes/[archetype].md
  - [each .claude/stacks/<category>/<value>.md read in STATE 2]
---
```

Then append the plan body. The frontmatter enables resume-after-clear without re-deriving archetype or stack. If `golden_path` was derived (not already in experiment.yaml), write it back to `experiment/experiment.yaml` after approval.

**Append Process Checklist** (skip if `current-plan.md` already contains `## Process Checklist`):

```markdown
## Process Checklist
- Skill: bootstrap
- Archetype: [archetype]
- [ ] BG1 Validation Gate passed
- [ ] Duplicate check resolved
- [ ] User approved plan
- [ ] TSP-LSP check completed
- [ ] scaffold-setup completed
- [ ] scaffold-init completed
- [ ] scaffold-libs completed
- [ ] scaffold-pages completed
- [ ] scaffold-externals completed
- [ ] scaffold-landing completed (or N/A: surface=none)
- [ ] Externals user decisions collected
- [ ] BG2.5 Externals Gate passed
- [ ] Merged checkpoint validation passed
- [ ] BG2 Orchestration Gate passed
- [ ] scaffold-wire completed
- [ ] BG4 PR Gate passed
```

Check off items already completed at this point:
- `- [x] BG1 Validation Gate passed`
- `- [x] Duplicate check resolved`
- `- [x] User approved plan`

If the user replied **"approve and clear"** or **"2"**:
  1. Save the plan with frontmatter (same as above)
  2. Tell the user: "Plan saved. Run `/clear`, then re-run `/bootstrap`. I'll resume at the checkpoint."
  3. STOP — do NOT proceed to STATE 8.

**POSTCONDITIONS**
- `.claude/current-plan.md` exists with YAML frontmatter
- Plan body is appended
- `## Process Checklist` section present with all 16 checklist items
- Items completed so far are checked off

**VERIFY**
- `test -f .claude/current-plan.md`
- `grep '## Process Checklist' .claude/current-plan.md`

**NEXT** -> STATE 8 (approve) | TERMINAL (approve and clear)

---

## STATE 8: PREFLIGHT

**PRECONDITIONS**
- Plan saved with Process Checklist (STATE 7 POSTCONDITIONS met)

**ACTIONS**

**Do NOT assemble file contents into the prompt.** Subagents are independent
Claude Code sessions with full file access — they read files themselves. The
prompt tells them WHICH files to read and WHAT to do.

> **WHY:** Embedded content becomes stale if files change between prompt
> construction and subagent execution. The subagent cannot verify embedded
> content matches disk, violating "observe, not trust." Embedded content
> also inflates prompt size, reducing the subagent's effective working
> memory (each 200 lines ≈ 2 lost reasoning turns). Let subagents read.

1. **Production quality check**: If `quality: production` is set in experiment.yaml, pass this flag to each scaffold-* agent prompt: "quality: production is set. Generate tests alongside each file you create." Agent test ownership:
   - scaffold-setup: create testing config (playwright.config.ts or vitest.config.ts)
   - scaffold-libs: generate unit tests for utility functions alongside library code
   - scaffold-pages: generate page-load smoke tests (same as MVP, but more thorough)
   - scaffold-wire: run test discovery checkpoint (`npx playwright test --list` or vitest equivalent)

   **Vitest co-installation**: When `quality: production` is set AND `stack.testing` is NOT `vitest` (e.g., `testing: playwright`):
   - Also install `vitest` and `@vitest/coverage-v8` as dev dependencies
   - Create `vitest.config.ts` using the template from `.claude/stacks/testing/vitest.md`
   - This ensures specification tests (TDD per `patterns/tdd.md`) can run alongside E2E tests
   - scaffold-setup handles this: check if vitest.config.ts exists before creating
   - Two test runners coexist: `npx playwright test` for E2E, `npx vitest run` for spec tests

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

Check off in `.claude/current-plan.md`: `- [x] TSP-LSP check completed`

**POSTCONDITIONS**
- `tsp_status` is set to `"available"` or `"skipped"`
- Quality flag recorded (production or MVP)

**VERIFY**
- `tsp_status` variable is non-empty
- Quality flag is set

**NEXT** -> STATE 9

---

## STATE 9: SETUP_PHASE

**PRECONDITIONS**
- Preflight done (STATE 8 POSTCONDITIONS met)
- `tsp_status` and quality flag available for subagent prompts

**ACTIONS**

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

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-design`.

**Resolve surface type** (used by Design Phase and Landing subagent). Evaluate in order — first match wins:
1. If `stack.surface` is set in experiment.yaml, use it.
2. If the archetype is `service` and `stack.surface` is not set and the experiment defines no `golden_path` and no `endpoints` that serve HTML (pure API with no user-facing surface): `none`.
3. If the archetype's `excluded_stacks` includes `hosting` and `stack.surface` is not set: `detached`.
4. Otherwise infer from hosting: `stack.services[0].hosting` present → `co-located`; absent → `detached`.

Check off in `.claude/current-plan.md`: `- [x] scaffold-setup completed`

**POSTCONDITIONS**
- `package.json` exists with `dependencies`
- `node_modules/` exists and is non-empty
- Surface type resolved
- Checkpoint updated to `phase2-design`

**VERIFY**
- `test -f package.json && test -d node_modules`

**NEXT** -> STATE 10

---

## STATE 10: DESIGN_PHASE

**PRECONDITIONS**
- Setup done (STATE 9 POSTCONDITIONS met)
- `package.json` and `node_modules/` exist
- Surface type resolved

**ACTIONS**

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

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-scaffold`.

Check off in `.claude/current-plan.md`: `- [x] scaffold-init completed`

**POSTCONDITIONS**
- `.claude/current-visual-brief.md` exists
- Theme tokens written (e.g., `src/app/globals.css` has `--primary`)
- Checkpoint updated to `phase2-scaffold`

**VERIFY**
- `test -f .claude/current-visual-brief.md`

**NEXT** -> STATE 11

---

## STATE 11: PARALLEL_SCAFFOLD

**PRECONDITIONS**
- Design done (STATE 10 POSTCONDITIONS met)
- `.claude/current-visual-brief.md` exists
- Theme tokens available

**ACTIONS**

#### scaffold-pages (two-phase)

**Phase A (serial, before fan-out, web-app only):** If the archetype is NOT `web-app`, skip Phase A entirely — service and CLI archetypes do not have an app shell. Proceed directly to Phase B.

The lead (not a subagent) creates:
- Root layout (`src/app/layout.tsx`) with font imports and globals.css
- 404 page (`src/app/not-found.tsx`)
- Error boundary (`src/app/error.tsx`)
- Variant routing files (if `variants` in experiment.yaml): `src/lib/variants.ts`, `src/app/page.tsx`, `src/app/v/[variant]/page.tsx`

Phase A runs AFTER scaffold-init completes (STATE 10) to ensure design tokens exist.

After creating all Phase A files, write the Phase A sentinel:
```bash
mkdir -p .claude/gate-verdicts
cat > .claude/gate-verdicts/phase-a-sentinel.json << 'PAEOF'
{"phase_a_complete": true, "timestamp": "<ISO 8601>", "files": ["src/app/layout.tsx", "src/app/not-found.tsx", "src/app/error.tsx"]}
PAEOF
```

VERIFY Phase A before proceeding to Phase B:
- `test -f src/app/layout.tsx`
- `test -f src/app/not-found.tsx`
- `test -f src/app/error.tsx`
- `test -f .claude/gate-verdicts/phase-a-sentinel.json`

**DO NOT proceed to Phase B until all VERIFY checks pass.**

**Phase B (parallel fan-out):** Spawn one `scaffold-pages` agent per golden_path page (excluding landing — handled by scaffold-landing). All in a SINGLE parallel message alongside scaffold-libs, scaffold-externals, scaffold-landing.

Each per-page agent prompt:
- "Create SINGLE page: `<page_name>` at route `<route>`."
- Write ONLY to `src/app/<page_name>/` — do NOT write to `src/components/` or `src/lib/`
- Write trace as `scaffold-pages-<page_name>.json`
- Read context files: `experiment/experiment.yaml`, `experiment/EVENTS.yaml`,
  `.claude/current-plan.md`, archetype file,
  framework/UI stack files, `.claude/patterns/design.md`,
  `.claude/current-visual-brief.md`
- Follow CLAUDE.md Rules 3, 4, 6, 7, 9

After all return, merge per-page traces into `scaffold-pages.json`:

```bash
python3 -c "
import json, glob
batches = sorted(glob.glob('.claude/agent-traces/scaffold-pages-*.json'))
if not batches:
    exit(1)
merged = {'agent': 'scaffold-pages', 'pages_created': 0, 'files_created': [], 'issues': []}
for b in batches:
    d = json.load(open(b))
    merged['pages_created'] += 1
    merged['files_created'].extend(d.get('files_created', []))
    merged['issues'].extend(d.get('issues', []))
json.dump(merged, open('.claude/agent-traces/scaffold-pages.json', 'w'))
print(f'Merged {len(batches)} per-page traces into scaffold-pages.json')
"
```

Spawn the following subagents simultaneously using parallel Agent tool calls:

**Libs subagent:**
- subagent_type: scaffold-libs
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/scaffold-libs.md` and execute all steps
  2. Read context files: `experiment/experiment.yaml`, `experiment/EVENTS.yaml`,
     `.claude/current-plan.md`, all stack files
  3. Follow CLAUDE.md Rules 3, 4, 6, 7

**Scope guard**: Enumerate the golden_path pages from experiment.yaml (excluding landing). Spawn agents for ONLY these pages -- no additional pages from any other source. If a page is not in golden_path, it is NOT built during bootstrap.

**Per-page subagents (one per golden_path page, excluding landing):**
- subagent_type: scaffold-pages
- prompt per page: See scaffold-pages two-phase instructions above.

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
  2. Read context files: `experiment/experiment.yaml`, `experiment/EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     framework/UI/surface stack files,
     `.claude/patterns/design.md`, `.claude/patterns/messaging.md`,
     `.claude/current-visual-brief.md`,
     `src/app/globals.css` (theme tokens from init phase)
  3. Follow CLAUDE.md Rules 3, 4, 6, 7, 9

Wait for all subagents to return.

**Post-fan-out trace verification** (before proceeding to trace merge):
Verify each subagent produced its expected output:
- `test -f .claude/agent-traces/scaffold-libs.json` (or agent reported completion with files list)
- `test -f .claude/agent-traces/scaffold-pages-<page>.json` for each golden_path page
- Landing subagent reported completion

If any trace is missing or output was truncated: note the gap for STATE 13 to address.

Check off in `.claude/current-plan.md` for each completed subagent:
- `- [x] scaffold-libs completed`
- `- [x] scaffold-pages completed`
- `- [x] scaffold-externals completed`
- `- [x] scaffold-landing completed` (or mark N/A if surface=none)

**POSTCONDITIONS**
- All subagents returned completion reports
- `src/lib/` contains ≥1 `.ts` file
- Page/route files created per archetype
- Externals classification available
- Landing page created (if surface ≠ none)

**VERIFY**
- `ls src/lib/*.ts` returns files
- Archetype-specific: web-app → `test -f src/app/layout.tsx`; service → `ls src/app/api/`; cli → `test -f src/index.ts`

**NEXT** -> STATE 12

---

## STATE 12: EXTERNALS_DECISIONS

**PRECONDITIONS**
- Scaffold done, all subagents returned (STATE 11 POSTCONDITIONS met)
- Externals classification table available from scaffold-externals

**ACTIONS**

> **BLOCKING — present to user even if classification seems obvious.**
> The purpose is explicit user buy-in on external dependencies, not
> efficiency. Even if scaffold-externals reports "No external
> dependencies", confirm to the user: "No external dependencies
> detected. Proceeding." NEVER self-decide. NEVER skip this interaction.

After the externals subagent returns its classification table:

1. **Present classification to user**: show the core/non-core table and
   collect decisions (Fake Door / Skip / Full Integration / Provide now /
   Provision at deploy) for each dependency.
2. **Collect credentials**: for "Provide now" choices, ask the user for
   credential values.
3. **Execute remaining work**: generate external stack files (per
   scaffold-externals.md Steps 6-8), write env vars to `.env.local` and
   `.env.example`, create Fake Door entries.

If the externals subagent reported "No external dependencies", confirm
to the user and proceed.

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

**Fake Door VERIFY**: For each Fake Door component created:
- Confirm the file is in `src/app/<page>/` (NOT in `src/components/`)
- Confirm the parent page imports and renders the component
- If either check fails, move/fix the component immediately

Check off in `.claude/current-plan.md`:
- `- [x] Externals user decisions collected`

Write the externals decisions to disk as a durable artifact:
```bash
cat > externals-decisions.json << 'EXTEOF'
{
  "has_externals": <true|false>,
  "user_confirmed": true,
  "decisions": [<array of {"service","feature","classification","user_choice"}>],
  "fake_doors": [<array of {"feature","service","target_page","component_name","action_label"}>],
  "timestamp": "<ISO 8601>"
}
EXTEOF
```
If no external dependencies: `has_externals` is `false`, arrays are `[]`.

**BG2.5 Externals Gate**: Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG2.5 Externals Gate."

Check off in `.claude/current-plan.md`: `- [x] BG2.5 Externals Gate passed`

**POSTCONDITIONS**
- BG2.5 Externals Gate verdict is PASS
- User decisions collected for all external dependencies
- Fake Door components created (if any)
- Env vars written (if any)

**VERIFY**
- Gate-keeper returned `**Verdict: PASS**` for BG2.5

**NEXT** -> STATE 13

---

## STATE 13: MERGED_VALIDATION

**PRECONDITIONS**
- Externals done, BG2.5 PASS (STATE 12 POSTCONDITIONS met)

**ACTIONS**

Run combined verification after all parallel subagents complete — these checks catch compilation and semantic issues:

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
   event in experiment/EVENTS.yaml events map (filtered by `requires`
   and `archetypes` for current stack and archetype), grep for the event
   name in `src/` to confirm a tracking call exists. Also verify
   `PROJECT_NAME` and `PROJECT_OWNER` in `src/lib/analytics*.ts` are
   not `"TODO"`. Report missing events. Fix directly (budget: 2 attempts).
4. **Design tokens** (if archetype is `web-app`): verify `src/app/globals.css`
   contains a non-empty `--primary` custom property

If any check fails: the bootstrap lead fixes directly (it has full file access
as coordinator). Re-run `npm run build` after fixes. Budget: 2 fix attempts.
If still failing after 2 attempts: list all remaining errors and their file locations. Ask the user whether to (a) continue to wire phase and fix later, or (b) stop and investigate now.

Update checkpoint in `.claude/current-plan.md` frontmatter to `phase2-wire`.

Check off in `.claude/current-plan.md`: `- [x] Merged checkpoint validation passed`

**BG2 Orchestration Gate**: Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG2 Orchestration Gate. Verify: (1) npm run build passes; (2) scaffold output files exist (src/lib/*.ts, .claude/current-visual-brief.md, archetype-specific pages/routes/commands from experiment.yaml); (3) landing page exists if surface≠none; (4) checkpoint is phase2-scaffold or later; (5) if stack.analytics present: for each event in experiment/EVENTS.yaml events map (filtered by requires and archetypes for current stack and archetype), grep for the event name in src/ — BLOCK if any event is missing; (6) if stack.analytics present: grep src/lib/analytics*.ts for PROJECT_NAME and PROJECT_OWNER — BLOCK if either is 'TODO'." If gate-keeper returns BLOCK, fix missing outputs before STATE 14.

Check off in `.claude/current-plan.md`: `- [x] BG2 Orchestration Gate passed`

**POSTCONDITIONS**
- `npm run build` passes (exit code 0)
- All pages/endpoints/commands exist per archetype
- Analytics wired (if applicable)
- BG2 Orchestration Gate verdict is PASS
- Checkpoint updated to `phase2-wire`

**VERIFY**
- Gate-keeper returned `**Verdict: PASS**` for BG2
- `npm run build` exit code 0

**NEXT** -> STATE 14

---

## STATE 14: WIRE_PHASE

**PRECONDITIONS**
- BG2 PASS, build passes (STATE 13 POSTCONDITIONS met)

**ACTIONS**

Spawn a subagent via Agent with:
- subagent_type: scaffold-wire
- prompt: Tell the subagent to:
  1. Read `.claude/procedures/wire.md` and execute Steps 5 through 8b ONLY.
     Do NOT run Step 8 (verify.md) or Step 9 (PR).
  2. Read context files before starting: `experiment/experiment.yaml`, `experiment/EVENTS.yaml`,
     `.claude/current-plan.md`, `.claude/archetypes/<type>.md`,
     all `.claude/stacks/<category>/<value>.md` for categories in experiment.yaml `stack`,
     `.claude/patterns/visual-review.md`,
     `.claude/patterns/security-review.md`,
     `.github/PULL_REQUEST_TEMPLATE.md`
  3. Include the completion reports from init, libs, pages, landing, and
     externals subagents (external dep decisions, generated files, env vars)
     in the prompt so the wire subagent has context
  4. Follow CLAUDE.md Rules 1, 4, 5, 6, 7, 8, 10, 12

Update checkpoint in `.claude/current-plan.md` frontmatter to `awaiting-verify`.

Check off in `.claude/current-plan.md`: `- [x] scaffold-wire completed`

**POSTCONDITIONS**
- API routes created (if mutation behaviors exist)
- Wire integration complete
- Checkpoint updated to `awaiting-verify`

**VERIFY**
- Archetype-specific: web-app with mutations → `ls src/app/api/` shows route files; service → same; cli → commands wired

**NEXT** -> STATE 15

---

## STATE 15: COMMIT_AND_PUSH

**PRECONDITIONS**
- Wire done (STATE 14 POSTCONDITIONS met)
- Checkpoint is `awaiting-verify`

**ACTIONS**

- Stage files: `git add -A` (safe — `.gitignore` excludes `.env.local`, `.claude/gate-verdicts/`, and sensitive patterns). Verify: `git diff --cached --name-only | grep -iE '\.env\.local|\.key$|\.pem$|credentials|\.secret$|\.token$|service-account' && echo "STOP: secrets staged" || echo "OK"`.
- Commit: "Bootstrap MVP scaffold from experiment.yaml"
- **BG4 PR Gate**: Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG4 PR Gate. Verify: on feature branch (not main), git status shows no uncommitted changes to tracked files, commit message follows imperative mood." If gate-keeper returns BLOCK, fix blocking items before pushing.
- Push to the remote branch
- Delete `.claude/current-visual-brief.md` (keep `.claude/current-plan.md` — `/verify` needs it)
- Tell the user: "Bootstrap pushed. Run `/verify` to run verification and create the PR."

If `quality: production` is set in experiment.yaml, add to the user message:
> "Bootstrap complete with production quality mode. After `/verify`, run `/harden` to add TDD coverage to critical paths (auth, payment, data persistence)."

Check off in `.claude/current-plan.md`: `- [x] BG4 PR Gate passed`

**POSTCONDITIONS**
- All files committed (no uncommitted tracked changes)
- BG4 PR Gate verdict is PASS
- Branch pushed to remote
- `.claude/current-visual-brief.md` deleted

**VERIFY**
- Gate-keeper returned `**Verdict: PASS**` for BG4
- `git status` shows clean working tree (tracked files)
- `git log -1 --oneline` shows "Bootstrap MVP scaffold from experiment.yaml"

**NEXT** -> TERMINAL (run `/verify` next)
