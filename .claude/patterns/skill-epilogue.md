# Skill Epilogue — Template Observation for Non-Verify Skills

Follow this procedure at the end of code-writing skills that do NOT run `/verify`.

## Applicability

**Required for:** `/resolve` (and future code-writing skills that commit without running /verify)

**Skip for:**
- Skills that embed `/verify` (`/bootstrap`, `/change`, `/harden`, `/distribute`) — verify.md STATE 6 handles observation
- Skills with own validation loop (`/review` — iterative fix-validate in states 2a-2f, produces `review-complete.json`)
- Analysis-only skills (`/iterate`, `/retro`, `/solve`, `/optimize-prompt`, `/rollback`, `/teardown`) — no code changes to observe
- `/spec` — uses inline observation at Step 7c.2 (no commit gate possible)
- `/deploy` — observation remains best-effort at Step 5e (no commit gate possible)

## Step 1: Collect evidence (artifact-based, not memory-based)

```bash
# a. Collect all branch changes
git diff $(git merge-base main HEAD)...HEAD > .claude/observer-diffs.txt

# b. Read fix-log (if exists)
# .claude/fix-log.md — created during skill execution when retries/failures occur

# c. Generate template file list
find .claude/stacks .claude/commands .claude/patterns scripts -type f 2>/dev/null | sort
# Plus: Makefile, CLAUDE.md
```

## Step 2: Write epilogue context

Write `.claude/epilogue-context.json`:
```json
{
  "skill": "<skill-name>",
  "mode": "epilogue",
  "timestamp": "<ISO 8601>",
  "branch": "<current branch>"
}
```

This file signals to `agent-state-gate.sh` that the observer is being
spawned from a skill epilogue (not from verify.md), enabling the relaxed
prerequisite path.

## Step 3: Fast-path evaluation

If `.claude/observer-diffs.txt` is empty AND `.claude/fix-log.md` has no entries
(or does not exist):

Write `.claude/observe-result.json`:
```json
{
  "skill": "<skill-name>",
  "timestamp": "<ISO 8601>",
  "friction_detected": false,
  "observations_filed": 0,
  "verdict": "clean"
}
```

**DONE.** Zero overhead on the happy path. The commit gate
(`observe-commit-gate.sh`) is satisfied.

## Step 4: Spawn observer

If evidence exists (non-empty diff or fix-log entries):

1. Prepare observer inputs:
   - Content of `.claude/observer-diffs.txt`
   - Content of `.claude/fix-log.md` (or "no fix-log entries")
   - Template file list from Step 1c
   - Skill name

2. Spawn the `observer` agent (`subagent_type: observer`).
   Pass ONLY the inputs above — do NOT include experiment.yaml content,
   project name, or feature descriptions.
   The observer follows `.claude/patterns/observe.md` Path 1 criteria.

3. After observer returns, write `.claude/observe-result.json`:
   ```json
   {
     "skill": "<skill-name>",
     "timestamp": "<ISO 8601>",
     "friction_detected": true,
     "observations_filed": <N>,
     "verdict": "filed" | "no-template-issues"
   }
   ```
   - `"filed"` — observer created or commented on GitHub issues
   - `"no-template-issues"` — observer evaluated but found no template-rooted issues

4. If observer spawning fails for any reason, write observe-result.json with
   `"verdict": "no-template-issues"` and continue. Observation is best-effort.

## Constraints

- **Best-effort.** Any failure in the epilogue → write observe-result.json with
  `"verdict": "clean"` and continue. Never block the skill.
- **Max 1 observer spawn per epilogue.** Combine all evidence into a single evaluation.
- **No project-specific data in observer prompt.** Follow observe.md redaction rules.
