# Verification Procedure

Run this procedure after making code changes and before committing.

> **Do NOT skip this procedure.** Do NOT claim the build passes without running it. Do NOT commit without a passing build. There are no exceptions.

## Scope Parameter

This procedure accepts an optional **scope** that controls which review agents run.
If no scope is specified, the default is `full`.

| Scope      | Agents spawned                                                              |
|------------|-----------------------------------------------------------------------------|
| `full`     | build-info, design-critic\*, ux-journeyer\*, behavior-verifier, security pair, perf\*\*, a11y\*\*, spec-reviewer\*\*\* |
| `security` | build-info, behavior-verifier, security pair, spec-reviewer\*\*\*           |
| `visual`   | build-info, design-critic\*, ux-journeyer\*, perf\*\*, a11y\*\*            |
| `build`    | build-info only                                                             |

\* = skip if archetype is NOT `web-app`
\*\* = web-app only (existing gate)
\*\*\* = quality: production only (existing gate)

behavior-verifier runs for all archetypes (web-app, service, cli) — it has archetype-specific procedures internally.

Build & Lint Loop, Auto-Observe, and Save Notable Patterns ALWAYS run regardless of scope.

> **Agent spawning is determined by scope and archetype only** — never by which files were changed in this PR. Do NOT skip agents because "no pages were modified" or "only backend changed." If the scope table says an agent runs for this scope+archetype combination, spawn it.

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

## Agent Review (after build passes)

> **Write Conflict Prevention**: Edit-capable agents (design-critic, ux-journeyer, security-fixer)
> MUST run serially in the order listed below — never in parallel. They modify source files and
> concurrent edits cause file-level conflicts. Read-only agents run in parallel as before.

### File Boundary for Edit-Capable Agents

Before spawning review agents, compute the PR file boundary:

```bash
git diff --name-only $(git merge-base HEAD main)...HEAD
```

Pass this list to each agent that has Edit/Write permissions (design-critic, ux-journeyer, security-fixer) as a hard constraint in the agent prompt:

> "You may ONLY modify files in this list: [files]. If you find issues in files outside this list, REPORT them in your verdict but do NOT edit them."

Read-only agents (observer, build-info-collector, behavior-verifier, security-attacker, security-defender, spec-reviewer, accessibility-scanner, performance-reporter) are unaffected.

**Phase 1 — Parallel read-only agents**: Spawn these agents simultaneously using parallel
Agent tool calls (they have no Edit/Write permissions and cannot conflict):

### build-info-collector

Spawn the `build-info-collector` agent (`subagent_type: build-info-collector`).

If build/lint errors were fixed above, pass: "Build errors were fixed
in this verification run. Collect the diff and summaries."

If no errors were fixed, pass: "No build errors were fixed."

### security-defender (if scope is `full` or `security`)

Spawn the `security-defender` agent (`subagent_type: security-defender`). No additional context needed.

### security-attacker (if scope is `full` or `security`)

Spawn the `security-attacker` agent (`subagent_type: security-attacker`). No additional context needed.

### behavior-verifier (if scope is `full` or `security`)

Spawn the `behavior-verifier` agent (`subagent_type: behavior-verifier`). No additional context needed.

### performance-reporter (if scope is `full` or `visual`, AND archetype is `web-app`)

Spawn the `performance-reporter` agent (`subagent_type: performance-reporter`). No additional context needed.

### accessibility-scanner (if scope is `full` or `visual`, AND archetype is `web-app`)

Spawn the `accessibility-scanner` agent (`subagent_type: accessibility-scanner`). No additional context needed.

### spec-reviewer (if scope is `full` or `security`, AND `quality: production` in experiment.yaml)

Read `experiment/experiment.yaml`. If `quality` field is set to `production`:
Spawn the `spec-reviewer` agent (`subagent_type: spec-reviewer`). Pass: "Read `.claude/agents/spec-reviewer.md` and execute all checks. Read `experiment/experiment.yaml` and `.claude/current-plan.md` (if it exists) as input. Return the output contract table and verdict."

If `quality` is absent or not `production`, skip this agent.

**Wait for all Phase 1 read-only agents to complete before proceeding to Phase 2.**

**Phase 2 — Serial edit-capable agents**: Spawn these agents ONE AT A TIME. Each must
complete and pass `npm run build` before the next is spawned. This prevents write conflicts.

### design-critic (if scope is `full` or `visual`, AND archetype is `web-app`) — SERIAL

Spawn the `design-critic` agent (`subagent_type: design-critic`). Pass PR file boundary. **Wait for completion.**
After completion: run `npm run build`. If build fails, fix (max 2 attempts) before next agent.

### ux-journeyer (if scope is `full` or `visual`, AND archetype is `web-app`) — SERIAL

Spawn the `ux-journeyer` agent (`subagent_type: ux-journeyer`). Pass PR file boundary. **Wait for completion.**
After completion: run `npm run build`. If build fails, fix (max 2 attempts) before next agent.

## Merge Security Results (if scope is `full` or `security`)

Combine security-defender and security-attacker outputs:

1. Collect all Defender FAILs and all Attacker findings.
2. If both flag the same file and issue, keep the more specific Attacker
   finding and mark the Defender check as subsumed (still counts as FAIL
   in the Defender table, but the Attacker finding drives the fix).
3. The merged list is the input to security-fixer.

## Parallel Fix Cycles (if scope is `full` or `security`, and security agents reported issues)

If security agents were not spawned (scope is `visual` or `build`), or reported no issues, skip this section.

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
   Do NOT include experiment.yaml content, project name, or feature descriptions.
5. Report the observer's result.

## Write Verification Report

After all review agents, fix cycles, and auto-observe complete, write `.claude/verify-report.md`:

```markdown
---
timestamp: [ISO 8601]
scope: [full|security|visual|build]
build_attempts: [1-3]
agents_expected: [list from scope table]
agents_completed: [list as they finish]
consistency_scan: pass | skipped | N/A
auto_observe: ran | skipped-no-fixes | observations-filed
---

## Build
- Attempts: [N]/3
- Result: pass
- Last output: [last 3-5 lines of build output]

## Review Agents
| Agent | Verdict | Notes |
|-------|---------|-------|
| design-critic | [pass/fixed/skipped] | [1-line summary] |
| ux-journeyer | [pass/fixed/skipped] | [1-line summary] |
| security-defender | [pass/N issues] | [1-line summary] |
| security-attacker | [pass/N findings] | [1-line summary] |
| security-fixer | [fixed N/skipped] | [1-line summary] |
| behavior-verifier | [pass/N issues] | [1-line summary] |
| performance-reporter | [summary/skipped] | [1-line summary] |
| accessibility-scanner | [pass/N issues/skipped] | [1-line summary] |
| spec-reviewer | [pass/N gaps/skipped] | [1-line summary] |

## Observations Filed
- [list, or "None"]

## Process Compliance
> Populated when `quality: production`. Otherwise: "N/A — MVP mode".

- Process Checklist in current-plan.md: [present | missing]
- TDD order: [pass | WARN — N violations | N/A]
- Source: spec-reviewer S8
```

Only include agents that were spawned (per scope). Mark others as "skipped — out of scope".

> **This file is a hard gate.** The commit/PR step in the calling skill
> reads this file and includes its contents in the PR body. If the file
> does not exist, the PR step must run verify.md first.

## Save Notable Patterns (if you fixed any errors above)

After a successful verification where you fixed any errors (build, lint, visual, or security):

1. For each error you fixed, decide: is this **universal** or **project-specific**?
   - **Universal** (applies to any project with this stack): add the pattern to the relevant
     `.claude/stacks/<category>/<value>.md` file
   - **Project-specific** (unique to this codebase): save a brief entry to your auto memory
     with the error, cause, and fix
2. Skip if: the error was a simple typo or something unlikely to recur
3. **Planning patterns**: If the change revealed patterns useful for future planning (distinct from error-fix patterns — these capture architectural knowledge):
   - Auth flow interactions (e.g., "OAuth callback must be registered before adding social login pages")
   - Stack integration quirks that affected architecture (e.g., "Supabase RLS requires service role key for admin operations")
   - Codebase conventions that future plans should follow (e.g., "this project co-locates API types in a shared types.ts")
   - Save to auto memory under "Planning Patterns" heading
