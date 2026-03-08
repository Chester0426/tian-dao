# Verification Procedure

Run this procedure after making code changes and before committing.

> **Do NOT skip this procedure.** Do NOT claim the build passes without running it. Do NOT commit without a passing build. There are no exceptions.

## Build & Lint Loop (max 3 attempts)

> **Budget rationale:** 3 attempts allows iterative refinement with error feedback.
> Attempt 1 catches the obvious error. Attempt 2 catches cascading effects.
> Attempt 3 is the safety net. All skills use this budget for consistency.

You have a budget of **3 attempts** to get a clean build and lint. Track each failed
attempt so you can reference previous errors and avoid repeating them.

For each attempt:

1. Run `npm run build`
2. If build fails: note the errors (mentally log: "Attempt N — build: [error summary]").
   Fix the errors, then start the next attempt.
3. If build passes: run `npm run lint` (skip if no lint script exists).
   Warnings are OK; errors are not.
4. If lint fails: note the errors (mentally log: "Attempt N — lint: [error summary]").
   Fix the errors, then start the next attempt.
5. If both pass: build and lint verification passed. Continue to Parallel Review below — do NOT skip the remaining verification steps.
6. **Prove it.** Quote the last 3–5 lines of the build output in your response. State facts: "Build completed with 0 errors. Lint passed with 0 warnings." Never say "should work", "probably passes", or "seems fine."

**If all 3 attempts fail**, stop and report to the user:

> **Build verification failed after 3 attempts.** Here's what I tried:
>
> - Attempt 1: [what failed and what I changed]
> - Attempt 2: [what failed and what I changed]
> - Attempt 3: [what still fails]
>
> The remaining errors are: [paste current errors]
>
> **Your options:**
> 1. **Tell me what to try** — describe the fix and I'll implement it on this branch
> 2. **Save and investigate later** — run `git add -A && git commit -m "WIP: build not passing yet"`, then `git checkout main`. Your WIP is safe on the feature branch. Resume later with `git checkout <branch>` and tell me the remaining errors.
> 3. **Start fresh** — run `git add -A && git commit -m "WIP: discarding"`, then `git checkout main`, then `make clean`, then `/bootstrap`. **Warning:** `make clean` deletes all generated code — only committed code is preserved in git history.
> 4. **Debug on this branch later** — switch to this branch (`git checkout <branch>`) and describe the remaining build errors directly. Do not re-run `/bootstrap` or `/change` — those create new branches. Just tell Claude what errors remain and it will fix them here.

Do NOT commit code that fails build or lint. Do NOT skip this procedure.

## Parallel Review (after build passes)

Spawn **up to seven agents simultaneously** using parallel Agent tool calls. All
agents read already-built code and have no data dependencies on each other.

### build-info-collector

Spawn the `build-info-collector` agent (`subagent_type: build-info-collector`).

If build/lint errors were fixed above, pass: "Build errors were fixed
in this verification run. Collect the diff and summaries."

If no errors were fixed, pass: "No build errors were fixed."

### design-critic

Spawn the `design-critic` agent (`subagent_type: design-critic`). No additional context needed.

### security-defender

Spawn the `security-defender` agent (`subagent_type: security-defender`). No additional context needed.

### security-attacker

Spawn the `security-attacker` agent (`subagent_type: security-attacker`). No additional context needed.

### ux-journeyer

Spawn the `ux-journeyer` agent (`subagent_type: ux-journeyer`). No additional context needed.

### performance-reporter (if archetype is `web-app`)

Spawn the `performance-reporter` agent (`subagent_type: performance-reporter`). No additional context needed.

### accessibility-scanner (if archetype is `web-app`)

Spawn the `accessibility-scanner` agent (`subagent_type: accessibility-scanner`). No additional context needed.

### spec-reviewer (if `quality: production` in idea.yaml)

Read `idea/idea.yaml`. If `quality` field is set to `production`:
Spawn a `general-purpose` agent. Pass: "Read `.claude/agents/spec-reviewer.md` and execute all checks. Read `idea/idea.yaml` and `.claude/current-plan.md` (if it exists) as input. Return the output contract table and verdict."

If `quality` is absent or not `production`, skip this agent.

**Wait for all agents to complete before continuing.**

## Merge Security Results

Combine security-defender and security-attacker outputs:

1. Collect all Defender FAILs and all Attacker findings.
2. If both flag the same file and issue, keep the more specific Attacker
   finding and mark the Defender check as subsumed (still counts as FAIL
   in the Defender table, but the Attacker finding drives the fix).
3. The merged list is the input to security-fixer.

## Parallel Fix Cycles (if needed)

If security agents reported no issues, skip this section.

### security-fixer (if merged security has issues)

Spawn the `security-fixer` agent (`subagent_type: security-fixer`).
Pass: merged Defender table + Attacker findings.

**Wait for the fixer to complete before continuing.**

## Auto-Observe

If build-info-collector reported "no build fixes" AND no fix cycles ran,
skip this section.

1. Combine all collected diffs (from build-info-collector + design-critic + ux-journeyer + security-fixer).
2. Combine all fix summaries.
3. Get template file list (from build-info-collector, or generate now:
   run `find .claude/stacks .claude/commands .claude/patterns scripts -type f 2>/dev/null`
   and add `Makefile` and `CLAUDE.md`).
4. Spawn the `observer` agent (`subagent_type: observer`).
   Pass ONLY: combined diff, combined summaries, template file list.
   Do NOT include idea.yaml content, project name, or feature descriptions.
5. Report the observer's result.

## Save Notable Patterns (if you fixed any errors above)

After a successful verification where you fixed any errors (build, lint, visual, or security):

1. For each error you fixed, decide: is this **universal** or **project-specific**?
   - **Universal** (applies to any project with this stack): add the pattern to the relevant
     `.claude/stacks/<category>/<value>.md` file
   - **Project-specific** (unique to this codebase): save a brief entry to your auto memory
     with the error, cause, and fix
2. Skip if: the error was a simple typo or something unlikely to recur
