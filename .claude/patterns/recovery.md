# Error Recovery Pattern

## Principles
1. **Idempotency first**: Skills should be safe to re-run after failure
2. **State checkpoints**: Skills save progress so re-runs skip completed steps
3. **Partial cleanup guidance**: When re-run isn't possible, document manual cleanup

## Per-Skill Recovery Matrix

### /bootstrap failure
- **State saved:** `.claude/current-plan.md` (plan), `package.json` (installed packages)
- **Recovery:** Re-run `/bootstrap` — Step 4 precondition detects partial bootstrap and continues
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
- **State saved:** `.claude/current-plan.md` on feature branch
- **Recovery:** Re-run `/change` on the same branch — Step 4 detects existing plan and resumes Phase 2
- **Manual cleanup:** `git checkout main && git branch -d <branch-name>`

### /verify failure
- **State saved:** Fix attempts on current branch
- **Recovery:** Re-run `/verify` — starts fresh test run
- **Manual cleanup:** None needed — verify doesn't modify infrastructure

### /distribute failure
- **State saved:** `idea/ads.yaml` (campaign config)
- **Recovery:** Re-run `/distribute` — reads existing ads.yaml
- **Manual cleanup:** Delete `idea/ads.yaml` to regenerate

### /harden failure
- **State saved:** `idea/on-touch.yaml`, specification tests on feature branch
- **Recovery:** Re-run `/harden` on the same branch — completed modules already have tests
- **Manual cleanup:** `git checkout main && git branch -d <branch-name>`

## Generic Recovery Steps
1. Check which branch you're on: `git branch --show-current`
2. Check what files changed: `git status`
3. If on a feature branch with uncommitted changes:
   - Save progress: `git add -A && git commit -m "WIP: recovery point"`
   - Start fresh: `git checkout main`
4. Re-run the skill — most skills detect existing state and resume
