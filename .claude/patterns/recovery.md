# Error Recovery Pattern

## Principles
1. **Idempotency first**: Skills should be safe to re-run after failure
2. **State checkpoints**: Skills save progress so re-runs skip completed steps
3. **Partial cleanup guidance**: When re-run isn't possible, document manual cleanup

## Frontmatter-Based Resume

When `.claude/current-plan.md` has YAML frontmatter, skills resume at the exact
checkpoint without re-deriving classification or stack.

| Field | Purpose |
|-------|---------|
| `skill` | Which skill (`change` / `bootstrap` / `harden`) |
| `type` | Change classification — skip re-classification |
| `scope` | Verification scope — skip re-derivation |
| `archetype` | Product archetype — skip experiment.yaml type read |
| `branch` | Git branch — informational |
| `stack` | All category/value pairs — skip stack resolution |
| `checkpoint` | Exact resume position |
| `modules` | Ordered list of modules to harden — `/harden` only |
| `context_files` | Files to re-read on resume — full state reconstruction |

**Backward compatible:** No frontmatter → current behavior (skip Phase 1, start at Phase 2 beginning).

## Per-Skill Recovery Matrix

### /bootstrap failure
- **State saved:** `.claude/current-plan.md` with frontmatter (archetype, stack, checkpoint), `package.json` (installed packages)
- **Recovery:** Re-run `/bootstrap` — Step 4 reads frontmatter checkpoint and resumes at exact phase
- **If checkpoint is `awaiting-verify`:** Bootstrap completed successfully. Run `/verify` (not `/bootstrap`) to validate and create the PR.
- **Manual cleanup:** If you want to start fresh: `git checkout main && make clean`

### /deploy failure (most common)
- **State saved:** `.claude/deploy-manifest.json` (resources created so far)
- **Partial state scenarios:**
  | Failed at | Resources exist | Recovery |
  |-----------|----------------|----------|
  | Step 3 (database) | Database project | Re-run `/deploy` — Step 3 checks for existing project |
  | Step 4 (hosting) | Database + hosting project | Re-run `/deploy` — Step 4 is idempotent (vercel link reuses existing) |
  | Step 4.4 (env vars) | DB + hosting (no env vars) | Re-run `/deploy` — env vars use upsert semantics |
  | Step 5a (deploy cmd) | DB + hosting + env vars | Re-run `/deploy` — redeploy is safe |
  | Step 5b (agents) | DB + hosting + deployed | Re-run `/deploy` — agents check for existing resources |
- **Nuclear option:** Run `/teardown` (reads manifest, deletes everything in reverse)

### /change failure
- **State saved:** `.claude/current-plan.md` with frontmatter (type, scope, archetype, stack, checkpoint) on feature branch
- **Recovery:** Re-run `/change` on the same branch — Step 4 reads frontmatter checkpoint and resumes at exact step
- **Manual cleanup:** `git checkout main && git branch -d <branch-name>`

### /verify failure
- **State saved:** Fix attempts on current branch, `.claude/agent-traces/` (partial trace artifacts)
- **Recovery:** Re-run `/verify` — starts fresh test run. If resuming after bootstrap (`current-plan.md` has `checkpoint: awaiting-verify`), `/verify` detects bootstrap-verify mode and runs full verification + PR creation.
- **Manual cleanup:** Trace cleanup is now automatic in STATE 0 (`rm -rf .claude/agent-traces && mkdir -p .claude/agent-traces`). No manual cleanup needed. Verify itself does not modify infrastructure.

### /distribute failure
- **State saved:** `experiment/ads.yaml` (campaign config)
- **Recovery:** Re-run `/distribute` — reads existing ads.yaml
- **Manual cleanup:** Delete `experiment/ads.yaml` to regenerate

### /harden failure
- **State saved:** `.claude/current-plan.md` with frontmatter (archetype, stack, checkpoint, modules), `experiment/on-touch.yaml`, specification tests on feature branch
- **Recovery:** Re-run `/harden` on the same branch — Step 0 reads frontmatter checkpoint and resumes at exact module. Completed modules already have tests.
- **Manual cleanup:** `git checkout main && git branch -d <branch-name>`

## Generic Recovery Steps
1. Check which branch you're on: `git branch --show-current`
2. Check what files changed: `git status`
3. If on a feature branch with uncommitted changes:
   - Save progress: `git add -A && git commit -m "WIP: recovery point"`
   - Start fresh: `git checkout main`
4. Re-run the skill — most skills detect existing state and resume
