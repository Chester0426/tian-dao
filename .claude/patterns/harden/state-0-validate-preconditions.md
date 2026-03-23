# STATE 0: VALIDATE_PRECONDITIONS

**PRECONDITIONS:**
- Git repository exists in working directory

**ACTIONS:**

- `package.json` exists (app is bootstrapped). If not -> stop: "No app found. Run `/bootstrap` first."
- `npm run build` passes. If not -> stop: "App has build errors. Run `/change fix build errors` first."
- If `quality: production` already set in experiment.yaml AND no `$ARGUMENTS`: stop -- "Already in production mode. Use `/harden <module>` to harden a specific module, or `/change` for new features."
- If `.claude/current-plan.md` exists AND the current branch starts with `chore/harden`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `archetype`, `stack`, `checkpoint`, and `modules` from frontmatter. If parsing fails (invalid YAML or missing required fields): stop -- "Plan file has corrupted frontmatter. Delete `.claude/current-plan.md` and re-run `/harden` to start fresh."
     - Use these values directly -- do NOT re-scan or re-classify
     - Read all files listed in `context_files` to restore source-of-truth context. If a listed file no longer exists, skip it and warn the user.
     - Resume at the step indicated by `checkpoint`:
       - `step2-approval` -> STATE 2 (plan ready, waiting for approval)
       - `step3-setup` -> STATE 4 (branch + config setup)
       - `step3-module-N` -> STATE 5 at module N (skip completed modules)
       - `step3-reconcile` -> STATE 6 (all modules done, reconciliation)
       - `step3-verify` -> STATE 8 (run /verify)
       - `step3-pr` -> STATE 9 (commit/push/PR)
     - Tell user: "Resuming /harden from [checkpoint]. [M of N] modules completed.\n  Done: [list completed module names]. Remaining: [list remaining module names].\n  Do NOT re-run completed modules."
  2. If no frontmatter (old format): fall back -- scan for CRITICAL modules without test files and proceed from STATE 5 (module implementation loop), after running STATEs 4 (branch, config, testing setup) if not already done.
- If on a `chore/harden-*` branch with existing specification tests but NO `.claude/current-plan.md`: a previous `/harden` may have partially completed. Tell the user: "Found existing hardening work on this branch. Scanning for modules that still need tests..." Then scan for CRITICAL modules without test files and proceed from STATE 5 (module implementation loop), skipping STATE 4 if branch and config are already set up.

Create `.claude/harden-context.json` to initialize state tracking:
```bash
cat > .claude/harden-context.json << CTXEOF
{"skill":"harden","branch":"$(git branch --show-current)","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","completed_states":["0"]}
CTXEOF
```

**POSTCONDITIONS:**
- `package.json` exists
- `npm run build` passes
- `.claude/harden-context.json` exists
- Resume path determined (fresh start or checkpoint resume)

**VERIFY:**
```bash
test -f package.json && test -f .claude/harden-context.json && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh harden 0
```

**NEXT:** If resuming from a checkpoint, read the target state file indicated by the checkpoint. Otherwise, read [state-1-scan-and-classify.md](state-1-scan-and-classify.md) to continue.
