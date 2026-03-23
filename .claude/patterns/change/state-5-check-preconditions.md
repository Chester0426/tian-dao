# STATE 5: CHECK_PRECONDITIONS

**PRECONDITIONS:**
- Classification determined (STATE 4 POSTCONDITIONS met)

**ACTIONS:**

> **Precondition types:** This step contains two kinds of checks: (1) *condition-specific* checks that trigger based on what the change involves (e.g., adding payment, setting production mode), applying to all change types when the condition is met; and (2) *type-specific* checks that apply only to certain classifications (e.g., Test, Upgrade). Both must be evaluated.

> **Branch cleanup on failure:** Any "stop" in this step leaves you on a feature branch (created in Step 1). Include in the stop message: "To abort: `git checkout main && git branch -D <branch-name>`. To fix and retry: make the required changes to experiment.yaml, then re-run `/change`."

- If `.claude/current-plan.md` exists and the current branch starts with `change/`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `type`, `scope`, `archetype`, `stack`, and `checkpoint` from frontmatter. If parsing fails (invalid YAML or missing required fields): stop — "Plan file has corrupted frontmatter. Delete `.claude/current-plan.md` and re-run `/change` to start fresh."
     - Compare frontmatter `archetype` to current experiment.yaml `type`. If they differ: stop — "Saved plan was for archetype `<saved>`, but experiment.yaml now specifies `<current>`. Plans are archetype-specific. Options: (1) Revert experiment.yaml type to `<saved>`, or (2) Delete `.claude/current-plan.md` and re-run `/change` for a new plan."
     - Use these values directly — do NOT re-classify or re-resolve stack
     - Read archetype file and stack files using frontmatter values
     - Read all files listed in `context_files` to restore source-of-truth context (experiment.yaml, experiment/EVENTS.yaml, etc.). If a listed file no longer exists, skip it and warn the user.
     - Resume at the step indicated by `checkpoint`:
       - `phase2-gate` → Phase 2 Pre-flight (read procedures, write process checklist)
       - `phase2-step5` → Step 5 (update specs)
       - `phase2-step6` → Step 6 (specs done, implement — re-read the plan to determine which type constraints apply)
       - `phase2-step7` → Step 7 (implementation done, verify)
       - `phase2-step8` → Step 8 (verification done, commit/PR)
     - Tell user: "Resuming from [checkpoint]. Type: [type], Scope: [scope]."
  2. If no frontmatter (old format): read experiment.yaml `type` to resolve the current archetype. Warn the user: "Resuming from old-format plan. If the experiment archetype changed since this plan was created, delete `.claude/current-plan.md` and re-run `/change`." Then skip Phase 1, jump to Step 5.
- Else if `.claude/current-plan.md` exists but the current branch does NOT start with `change/`:
  - Read the plan's `branch` field from frontmatter (if present)
  - Tell the user: "Found a prior `/change` plan (`.claude/current-plan.md`) but you're on `<current-branch>`, not a `change/` branch. Options:\n  1. Resume on the saved branch: `git checkout <saved-branch>` then re-run `/change`\n  2. Start fresh: delete the plan (`rm .claude/current-plan.md`) and re-run `/change`"
  - Stop — do NOT proceed until the user chooses.
> **If resuming from a failed /change:** see `.claude/patterns/recovery.md`. The plan in `.claude/current-plan.md` persists across sessions.
- If the change will add any new category to experiment.yaml `stack`: read the archetype file's `excluded_stacks` list. If the new category appears in `excluded_stacks`, stop: "The `<archetype>` archetype excludes the `<category>` stack. You cannot add `<category>: <value>` to this project."
- For analytics changes: verify the analytics library file exists (see analytics stack file for expected path). If it doesn't, stop and tell the user: "Analytics library not found. Run `/bootstrap` first."
- If `$ARGUMENTS` mentions payment or the change will add `payment` to the stack: verify `stack.auth` and `stack.database` are present in experiment.yaml. If `stack.auth` is missing, stop: "Payment requires authentication. Add `auth: supabase` (or another auth provider) to experiment.yaml `stack` first." If `stack.database` is missing, stop: "Payment requires a database. Add `database: supabase` (or another database provider) to experiment.yaml `stack` first."
- If `$ARGUMENTS` mentions email or the change will add `email` to the stack: verify `stack.auth` and `stack.database` are present in experiment.yaml. If `stack.auth` is missing, stop: "Email requires authentication to know who to send emails to. Add `auth: supabase` (or another auth provider) to experiment.yaml `stack` first." If `stack.database` is missing, stop: "Email requires a database to track user activation status. Add `database: supabase` (or another database provider) to experiment.yaml `stack` first." Then read the email stack file's `assumes` list and verify each `category/value` pair against experiment.yaml `stack` (the value must match exactly, not just the category — e.g., `framework/nextjs` requires `stack.services[].runtime: nextjs`). If any assumption is unmet, stop: "Email stack requires [unmet dependencies]. Current stack has [actual values]. Update experiment.yaml `stack` to match, or choose a different email provider."
- If `testing` is present in experiment.yaml `stack` and the classified type is NOT Test: read the testing stack file's `assumes` list and verify each `category/value` pair against experiment.yaml `stack` (the value must match exactly, not just the category — e.g., `database/supabase` requires `stack.database: supabase`, not just any database provider). If any assumption is unmet, stop: "Your testing setup assumes [unmet dependencies]. Tests will break. Run '/change fix test configuration' first, or remove 'testing' from experiment.yaml 'stack'." Then check archetype compatibility: if archetype is `service` or `cli` and `stack.testing` is `playwright`, stop: "Playwright requires a browser and is not compatible with the `<archetype>` archetype. Use `testing: vitest` instead."
- Validate framework-archetype compatibility: if archetype is `web-app` and framework is not `nextjs`, stop — "The `web-app` archetype requires `nextjs` as the framework. Change `stack.services[].runtime` to `nextjs`." If archetype is `cli` and framework is not `commander`, stop — "The `cli` archetype requires `commander` as the framework. Change `stack.services[].runtime` to `commander`."
- If `quality: production` is set in experiment.yaml:
  * Verify `stack.testing` is present in experiment.yaml
  * If absent: stop — "Production quality requires a testing framework. Add `testing: playwright` (web-app) or `testing: vitest` (service/cli) to experiment.yaml `stack`, or remove `quality: production` for MVP mode."
- If classified as Test type: check archetype compatibility first — if archetype is `service` or `cli` and `stack.testing` is `playwright`, stop: "Playwright requires a browser and is not compatible with the `<archetype>` archetype. Use `testing: vitest` instead." Then read the testing stack file's `assumes` list and check each `category/value` against experiment.yaml `stack` (per bootstrap's validation approach: the value must match, not just the category). Record the result — this determines the template path reported in the plan.
- If classified as Upgrade: scan for a Fake Door or stub related to the feature described in `$ARGUMENTS`. Where to scan depends on the archetype: web-app → scan `src/app/` for a Fake Door component (`fake_door: true` in a `track()` call) or a stub route (501/503); service → scan route handlers (path per framework stack file) for a stub route (501/503 with `"Service not configured"`); cli → scan `src/commands/` for a stub command (prints "Coming soon" or exits with error). If neither a Fake Door nor a stub is found, reclassify as Feature and tell the user: "No Fake Door or stub found for this feature — treating as a new Feature instead."

**POSTCONDITIONS:**
- All precondition checks passed (or resuming from checkpoint)
- No blocking conditions remain
- If resuming: checkpoint target state identified

**VERIFY:**
```bash
echo "Preconditions passed — proceeding to Phase 1 planning"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh change 5
```

**NEXT:** If resuming from a checkpoint, follow the checkpoint target (see resume logic above). Otherwise, read [state-6-present-plan.md](state-6-present-plan.md) to continue.
