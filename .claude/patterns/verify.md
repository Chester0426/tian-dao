# Verification Procedure

> **Process fidelity > throughput.** Every step exists because its value
> shows up in edge cases, not in the happy path. When a step's output
> "seems obvious," that is precisely when you must execute it — you
> cannot confirm it is obvious without executing. Skipping a step saves
> 2 minutes; fixing the consequences costs 2 hours.

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

Build & Lint Loop, E2E Tests, Auto-Observe, and Save Notable Patterns ALWAYS run regardless of scope.

> **Agent spawning is determined by scope and archetype only** — never by which files were changed in this PR. Do NOT skip agents because "no pages were modified" or "only backend changed." If the scope table says an agent runs for this scope+archetype combination, spawn it.

> **The scope table is the sole authority.** The absence of a running app, missing screenshots, or "obvious" results are NEVER valid reasons to skip a scope-required agent. Agents degrade gracefully to static analysis when runtime is unavailable — but they still run. No exceptions.

---

## STATE 0: READ_CONTEXT

**PRECONDITIONS:** None — this is the entry state.

**ACTIONS:**

1. Read context files:
   - Read `experiment/experiment.yaml` — understand pages (from golden_path), behaviors, stack
   - Read `experiment/EVENTS.yaml` — understand tracked events
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`)
   - If in bootstrap-verify or change-verify mode: read all files listed in current-plan.md `context_files`
   - If `stack.testing` is present in experiment.yaml, read `.claude/stacks/testing/<value>.md`

2. Write `.claude/verify-context.json`:
   ```bash
   cat > .claude/verify-context.json << 'CTXEOF'
   {"scope":"<scope>","archetype":"<type>","quality":"<quality|mvp>","timestamp":"<ISO 8601>"}
   CTXEOF
   ```

3. Create `.claude/fix-log.md` on disk:
   ```bash
   echo '# Error Fix Log' > .claude/fix-log.md
   ```

4. Create trace directory:
   ```bash
   mkdir -p .claude/agent-traces
   ```

**POSTCONDITIONS:** All 3 artifacts exist on disk.

**VERIFY:**
```bash
test -f .claude/verify-context.json && test -f .claude/fix-log.md && test -d .claude/agent-traces
```

**NEXT:** STATE 1

---

## STATE 1: BUILD_LINT_LOOP

**PRECONDITIONS:** STATE 0 complete (verify-context.json, fix-log.md, agent-traces/ exist).

> **Budget rationale:** 3 attempts allows iterative refinement with error feedback.
> Attempt 1 catches the obvious error. Attempt 2 catches cascading effects.
> Attempt 3 is the safety net. All skills use this budget for consistency.

**ACTIONS:**

You have a budget of **3 attempts** to get a clean build and lint. Track each failed
attempt so you can reference previous errors and avoid repeating them.

For each attempt:

1. Run `npm run build`
2. If build fails: note the errors (mentally log: "Attempt N — build: [error summary]").
   Fix the errors. Append each fix to `.claude/fix-log.md`:
   ```
   **Fix N:** `<file>` — Symptom: `<what broke>` — Cause: `<why>` — Fix: `<what you changed>`
   ```
   Then start the next attempt.
3. If build passes: run `npm run lint` (skip if no lint script exists).
   Warnings are OK; errors are not.
4. If lint fails: note the errors (mentally log: "Attempt N — lint: [error summary]").
   Fix the errors. Append each fix to `.claude/fix-log.md`. Then start the next attempt.
5. If both pass: build and lint verification passed. Continue to STATE 2 — do NOT skip the remaining verification steps.
6. **Prove it.** Quote the last 3–5 lines of the build output **verbatim in a code block**. State facts: "Build completed with 0 errors. Lint passed with 0 warnings." Never say "should work", "probably passes", or "seems fine." The verify-report-gate hook checks for this.

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

**POSTCONDITIONS:** Build passes. Lint passes (or no lint script).

**VERIFY:** Last build command exited 0.

**NEXT:** STATE 2

---

## STATE 2: PHASE1_PARALLEL

**PRECONDITIONS:** STATE 1 complete (build passes).

> **Write Conflict Prevention**: Edit-capable agents (design-critic, ux-journeyer, security-fixer)
> MUST run serially in Phase 3. Read-only agents run in parallel here.

### Dev Server Preamble (if archetype is `web-app`)

Before spawning review agents, start the dev server in demo mode so
that all visual agents have a running app to screenshot:

1. Start dev server:
   ```bash
   DEMO_MODE=true NEXT_PUBLIC_DEMO_MODE=true npm run dev &
   DEV_PID=$!
   ```
2. Wait for ready: poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
   until 200 (max 30s, 2s interval). If timeout: warn user, continue —
   agents degrade to static analysis but are NOT skipped.
3. Pass `base_url: http://localhost:3000` to all agents that accept it.
4. After ALL review agents (Phase 1 + Phase 2) complete: `kill $DEV_PID`.

> **Why DEMO_MODE.** All external clients (Supabase, Stripe, Anthropic,
> PostHog) have demo fallbacks returning safe stub data. The dev server
> runs fully functional pages without any API keys. Playwright is
> installed during Setup Phase (`npx playwright install chromium`).
>
> **There is no valid reason to skip visual agents during bootstrap.**
> DEMO_MODE + Playwright = zero external dependencies.

### File Boundary for Edit-Capable Agents

Before spawning review agents, compute the PR file boundary:

```bash
git diff --name-only $(git merge-base HEAD main)...HEAD
```

> If `git diff` returns empty (standalone on `main` or shallow clone), fall back to all source files:
> ```bash
> find src/ -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \)
> ```

Pass this list to each agent that has Edit/Write permissions (design-critic, ux-journeyer, security-fixer) as a hard constraint in the agent prompt:

> "You may ONLY modify files in this list: [files]. If you find issues in files outside this list, REPORT them in your verdict but do NOT edit them."

Read-only agents (observer, build-info-collector, behavior-verifier, security-attacker, security-defender, spec-reviewer, accessibility-scanner, performance-reporter) are unaffected.

### ACTIONS — Spawn Phase 1 agents

> **EXPLICIT FOREGROUND INSTRUCTION**: Spawn all Phase 1 agents as parallel foreground Agent tool calls in a **SINGLE message**. Do NOT use `run_in_background: true`. The platform blocks you until ALL return. This is the enforcement mechanism — background agents can be forgotten; foreground agents cannot.

Spawn the following agents simultaneously (per scope table):

#### build-info-collector

Spawn the `build-info-collector` agent (`subagent_type: build-info-collector`).

If build/lint errors were fixed above, pass: "Build errors were fixed
in this verification run. Collect the diff and summaries."

If no errors were fixed, pass: "No build errors were fixed."

#### security-defender (if scope is `full` or `security`)

Spawn the `security-defender` agent (`subagent_type: security-defender`). No additional context needed.

#### security-attacker (if scope is `full` or `security`)

Spawn the `security-attacker` agent (`subagent_type: security-attacker`). No additional context needed.

#### behavior-verifier (if scope is `full` or `security`)

Spawn the `behavior-verifier` agent (`subagent_type: behavior-verifier`). No additional context needed.

#### performance-reporter (if scope is `full` or `visual`, AND archetype is `web-app`)

Spawn the `performance-reporter` agent (`subagent_type: performance-reporter`). No additional context needed.

#### accessibility-scanner (if scope is `full` or `visual`, AND archetype is `web-app`)

Spawn the `accessibility-scanner` agent (`subagent_type: accessibility-scanner`). No additional context needed.

#### spec-reviewer (if scope is `full` or `security`, AND `quality: production` in experiment.yaml)

Read `experiment/experiment.yaml`. If `quality` field is set to `production`:
Spawn the `spec-reviewer` agent (`subagent_type: spec-reviewer`). Pass: "Read `.claude/agents/spec-reviewer.md` and execute all checks. Read `experiment/experiment.yaml` and `.claude/current-plan.md` (if it exists) as input. Return the output contract table and verdict."

If `quality` is absent or not `production`, skip this agent.

### Recovery traces

After all Phase 1 agents return, verify each spawned agent wrote a trace to `.claude/agent-traces/<name>.json`.

If an agent returned output but crashed before writing its trace, write a recovery trace:

```bash
echo '{"agent":"<name>","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"<agent-verdict>","checks_performed":<agent-checks-array>,"recovery":true}' > .claude/agent-traces/<name>.json
```

The `checks_performed` array must match the agent's specification (see each agent's Trace Output section). The `"recovery":true` flag marks this as a lead-written trace — gate-keeper will WARN on recovery traces.

Do NOT write traces for agents that were not spawned. Do NOT write traces for agents whose output you never received.

**POSTCONDITIONS:** All scope-required Phase 1 traces exist in `.claude/agent-traces/`.

**VERIFY:**
```bash
ls .claude/agent-traces/*.json
```

**NEXT:** STATE 3

---

## STATE 3: PHASE2_SERIAL

**PRECONDITIONS:** All Phase 1 traces exist (hook-enforced by `phase-transition-gate.sh`).

**ACTIONS:**

Spawn edit-capable agents ONE AT A TIME. Each must complete and pass `npm run build` before the next is spawned. This prevents write conflicts.

After each edit-capable agent completes, read its completion report and append its fixes to `.claude/fix-log.md`.

### design-critic (if scope is `full` or `visual`, AND archetype is `web-app`) — SERIAL

Spawn the `design-critic` agent (`subagent_type: design-critic`). Pass PR file boundary. **Wait for completion.**
After completion: verify `.claude/agent-traces/design-critic.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.
Run `npm run build`. If build fails, fix (max 2 attempts) before next agent.

#### Lead-side validation (design-critic)

1. Read `.claude/agent-traces/design-critic.json` trace.
2. Verify `pages_reviewed` >= number of pages in experiment.yaml `golden_path`.
3. If `verdict` == `"unresolved"`, this is a **hard gate failure** — design quality threshold (8/10) was not met after 2 fix attempts. Skip STATEs 4-6 but still write verify-report.md (STATE 7) recording the failure. Report failure to user with the `unresolved_sections` count.
4. If `min_score` < 8 and `verdict` == `"fixed"`, note in verify report that threshold was met after fixes.
5. If `pre_existing_debt` is non-empty, note pre-existing quality debt in verify report (informational, does not block).
6. Extract Fix Summaries from the agent's return message. Append each fix to `.claude/fix-log.md` with the prefix `Fix (design-critic):`.

### ux-journeyer (if scope is `full` or `visual`, AND archetype is `web-app`) — SERIAL

Spawn the `ux-journeyer` agent (`subagent_type: ux-journeyer`). Pass PR file boundary. **Wait for completion.**
After completion: verify `.claude/agent-traces/ux-journeyer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.
Run `npm run build`. If build fails, fix (max 2 attempts) before next agent.

#### Lead-side validation (ux-journeyer)

1. Read `.claude/agent-traces/ux-journeyer.json` trace.
2. If `verdict` == `"blocked"`, this is a **hard gate failure** — the golden path cannot be completed. Stop and report the blocked location to the user. Do NOT proceed to STATE 4.
3. If `unresolved_dead_ends` > 0, this is a **hard gate failure** — real dead ends remain after fixes. Skip STATEs 4-6 but still write verify-report.md (STATE 7) recording the failure.
4. If `dead_ends` > 0 AND `unresolved_dead_ends` == 0, all dead ends are intentional fake-door pages. Note in verify report (informational, does not block).
5. Extract Fix Summaries from the agent's return message. Append each fix to `.claude/fix-log.md` with the prefix `Fix (ux-journeyer):`.

### Design-UX Merge (if scope is `full` or `visual`, AND archetype is `web-app`)

After both design-critic and ux-journeyer have completed and their builds pass:

1. Read both traces:
   - `.claude/agent-traces/design-critic.json`
   - `.claude/agent-traces/ux-journeyer.json`

2. Compute the quality gate verdict:
   - **fail**: design-critic verdict is `"unresolved"` OR ux-journeyer verdict is `"blocked"`
   - **warn**: ux-journeyer `dead_ends` > 0 (but design-critic passed)
   - **pass**: neither condition triggered

3. Write `.claude/design-ux-merge.json`:
   ```bash
   cat > .claude/design-ux-merge.json << 'DUXEOF'
   {"timestamp":"<ISO 8601>","verdict":"<pass|warn|fail>","design_critic":{"verdict":"<verdict>","min_score":<S>,"weakest_page":"<page>","sections_below_8":<B>,"fixes_applied":<F>,"unresolved_sections":<U>,"pre_existing_debt":<DEBT>},"ux_journeyer":{"verdict":"<verdict>","clicks_to_value":<C>,"dead_ends":<D>,"coverage_pct":<P>,"fixes_applied":<F>}}
   DUXEOF
   ```

**POSTCONDITIONS:** All scope-required Phase 2 traces exist. Build passes. `design-ux-merge.json` exists (when scope is `full` or `visual` AND archetype is `web-app`).

**VERIFY:**
```bash
test -f .claude/design-ux-merge.json
```
Build command exited 0 after last Phase 2 agent.

**NEXT:** STATE 4

---

## STATE 4: SECURITY_MERGE_FIX

**PRECONDITIONS:** STATE 3 complete.

If security agents were not spawned (scope is `visual` or `build`), skip to STATE 5 (E2E_TESTS).

**ACTIONS:**

### Merge Security Results (if scope is `full` or `security`)

Combine security-defender and security-attacker outputs:

1. Collect all Defender FAILs and all Attacker findings.
2. If both flag the same file and issue, keep the more specific Attacker
   finding and mark the Defender check as subsumed (still counts as FAIL
   in the Defender table, but the Attacker finding drives the fix).
3. The merged list is the input to security-fixer.

### Write security-merge.json

Before spawning security-fixer, write the merge artifact:

```bash
cat > .claude/security-merge.json << 'MERGEEOF'
{"timestamp":"<ISO 8601>","defender_fails":<N>,"attacker_findings":<N>,"merged_issues":<N>,"issues":[<summary list>]}
MERGEEOF
```

### security-fixer (if merged security has issues)

Spawn the `security-fixer` agent (`subagent_type: security-fixer`).
Pass: merged Defender table + Attacker findings.

**Wait for the fixer to complete before continuing.**

After security-fixer completes: verify `.claude/agent-traces/security-fixer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.

After each fix, append to `.claude/fix-log.md`.

#### Lead-side validation (security-fixer)

1. Read `.claude/agent-traces/security-fixer.json` trace.
2. If `verdict` == `"partial"` AND `unresolved_critical` > 0, this is a **hard gate failure** — Critical/High security issues or Defender FAILs remain unfixed after 2 fix cycles. Skip STATEs 5-6 but still write verify-report.md (STATE 7) recording the failure. Report failure to user with the unresolved items.
3. If trace has `"recovery": true` AND `verdict` == `"partial"`, treat as hard gate failure (recovery traces cannot confirm fixes succeeded).
4. Extract Fix Summaries from the agent's return message. Append each fix to `.claude/fix-log.md` with the prefix `Fix (security-fixer):`.

**POSTCONDITIONS:** `security-merge.json` exists. Security-fixer trace exists (if spawned). If security-fixer verdict is `"partial"` with `unresolved_critical` > 0, pipeline is halted.

**VERIFY:**
```bash
test -f .claude/security-merge.json
```

**NEXT:** STATE 5 (E2E_TESTS)

---

## STATE 5: E2E_TESTS

**PRECONDITIONS:** STATE 4 complete (or skipped for visual/build scope).

**ACTIONS:**

- If `stack.testing` is NOT present in experiment.yaml → write `.claude/e2e-result.json`:
  ```bash
  echo '{"skipped":true,"reason":"no testing stack"}' > .claude/e2e-result.json
  ```
  Skip to STATE 6.

- If `stack.testing` is present but no test configuration file exists → write `.claude/e2e-result.json`:
  ```bash
  echo '{"skipped":true,"reason":"no test configuration"}' > .claude/e2e-result.json
  ```
  Skip to STATE 6.

- Otherwise: run E2E tests (3-attempt budget). For each failed attempt:
  1. Read test output, identify failures
  2. Fix issues (test code or app code)
  3. Append each fix to `.claude/fix-log.md`
  4. Re-run tests

  After tests pass (or budget exhausted), write `.claude/e2e-result.json`:
  ```bash
  cat > .claude/e2e-result.json << 'E2EEOF'
  {"passed":<true|false>,"attempts":<N>,"fixes":<N>}
  E2EEOF
  ```

**POSTCONDITIONS:** `e2e-result.json` exists.

**VERIFY:**
```bash
test -f .claude/e2e-result.json
```

**NEXT:** STATE 6

---

## STATE 6: AUTO_OBSERVE

**PRECONDITIONS:** STATE 5 complete (e2e-result.json exists).

**ACTIONS:**

Read `.claude/fix-log.md` from disk. If it has only the header line (`# Error Fix Log`) and no entries, skip to STATE 7.

If the Fix Log has any entries:

1. For each file mentioned in the Fix Log, capture its targeted diff.
2. Combine the per-file diffs + Fix Log summaries.
3. Get template file list (from build-info-collector, or generate now:
   run `find .claude/stacks .claude/commands .claude/patterns scripts -type f 2>/dev/null`
   and add `Makefile` and `CLAUDE.md`).
4. Spawn the `observer` agent (`subagent_type: observer`).
   Pass ONLY: combined fix diffs, Fix Log summaries, template file list.
   Do NOT include experiment.yaml content, project name, or feature descriptions.
5. Report the observer's result.
6. Verify `.claude/agent-traces/observer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.

**POSTCONDITIONS:** Observer ran (if fixes exist) or was correctly skipped.

**VERIFY:** If fix-log.md has entries beyond header, `observer.json` trace exists.

**NEXT:** STATE 7

---

## STATE 7: WRITE_REPORT

**PRECONDITIONS:** STATE 6 complete. All agents finished. All traces written.

> **This state is gated by `verify-report-gate.sh`.** The hook checks that
> verify-context.json, fix-log.md, and agent traces exist before allowing
> the write. If the hook denies the write, go back and complete the missing steps.

**ACTIONS:**

Write `.claude/verify-report.md`:

```markdown
---
timestamp: [ISO 8601]
scope: [full|security|visual|build]
build_attempts: [1-3]
fix_log_entries: [N]
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

> **Completion audit.** Before writing verify-report.md, compare
> `agents_expected` (from scope table) against `agents_completed`.
> If any expected agent was not spawned:
> - List it as `"SKIPPED — PROCESS VIOLATION"` (not `"skipped — out of scope"`)
> - Set `process_violation: true` in verify-report.md frontmatter
> - BG3 gate will BLOCK on process violations
>
> **Trace audit.** Count `.json` files in `.claude/agent-traces/`. If the count
> does not match the number of entries in `agents_completed`:
> - List missing traces as `"MISSING TRACE — PROCESS VIOLATION"`
> - Set `process_violation: true` in verify-report.md frontmatter

> **This file is a hard gate.** The commit/PR step in the calling skill
> reads this file and includes its contents in the PR body. If the file
> does not exist, the PR step must run verify.md first.

**POSTCONDITIONS:** `verify-report.md` exists with valid frontmatter.

**VERIFY:**
```bash
head -1 .claude/verify-report.md | grep -q '^---$'
```

**NEXT:** STATE 8

---

## STATE 8: SAVE_PATTERNS

**PRECONDITIONS:** STATE 7 complete.

If `.claude/fix-log.md` has only the header line and no entries, this state is a no-op — write `.claude/patterns-saved.json` with `{"saved":0,"skipped":0,"total":0}` and return.

**ACTIONS:**

Read `.claude/fix-log.md` from disk.

1. **For each entry in the Fix Log**, classify:
   - **Universal** (any project with this stack would hit this) →
     add to `.claude/stacks/<category>/<value>.md`
   - **Project-specific** (unique to this codebase) →
     save to auto memory with error, cause, and fix
   - **Simple typo** unlikely to recur → skip

2. **Verify completeness:** Count entries in Fix Log. Count patterns
   saved + skipped. The numbers must match. If not, re-read the log.

3. **Planning patterns** (architectural knowledge for future plans):
   - Auth flow interactions (e.g., "OAuth callback must be registered before adding social login pages")
   - Stack integration quirks that affected architecture (e.g., "Supabase RLS requires service role key for admin operations")
   - Codebase conventions that future plans should follow (e.g., "this project co-locates API types in a shared types.ts")
   - Save to auto memory under "Planning Patterns" heading

4. **Write classification artifact:**
   ```bash
   cat > .claude/patterns-saved.json << 'PEOF'
   {"saved":<N>,"skipped":<N>,"total":<N>}
   PEOF
   ```

**POSTCONDITIONS:** `patterns-saved.json` exists. Pattern count matches fix log entry count.

**VERIFY:**
```bash
test -f .claude/patterns-saved.json
```

**NEXT:** Done — return to calling skill.
