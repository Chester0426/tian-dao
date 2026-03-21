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

1. Clean trace directory (removes stale traces from prior runs):
   ```bash
   rm -rf .claude/agent-traces && mkdir -p .claude/agent-traces
   ```

2. Read context files:
   - Read `experiment/experiment.yaml` — understand pages (from golden_path), behaviors, stack
   - Read `experiment/EVENTS.yaml` — understand tracked events
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`)
   - If in bootstrap-verify or change-verify mode: read all files listed in current-plan.md `context_files`
   - If `stack.testing` is present in experiment.yaml, read `.claude/stacks/testing/<value>.md`

3. Write `.claude/verify-context.json` (includes `run_id` for trace freshness validation):
   ```bash
   cat > .claude/verify-context.json << CTXEOF
   {"scope":"<scope>","archetype":"<type>","quality":"<quality|mvp>","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","run_id":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
   CTXEOF
   ```

4. Create `.claude/fix-log.md` on disk:
   ```bash
   echo '# Error Fix Log' > .claude/fix-log.md
   ```

5. Extract context digest (in-memory, passed to agents in STATE 2/3):
   - Pages: list all page names and routes (union of `golden_path` and filesystem scan of `src/app/**/page.tsx`, excluding `/api/`)
   - Behavior IDs: list all behavior IDs from `behaviors`
   - Event names: list event names from `experiment/EVENTS.yaml`
   - Source file list: `find src/ -type f \( -name '*.ts' -o -name '*.tsx' \) | head -100`
   - PR changed files: `git diff --name-only $(git merge-base HEAD main)...HEAD`
   - Golden path steps: ordered list of steps from `golden_path`

**POSTCONDITIONS:** All 4 artifacts exist on disk (agent-traces dir, verify-context.json, fix-log.md). Context digest is available in-memory.

**VERIFY:**
```bash
test -f .claude/verify-context.json && test -f .claude/fix-log.md && test -d .claude/agent-traces
```

> **Hook-enforced:** `phase-transition-gate.sh` validates these postconditions before allowing the next state's agents to spawn.

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
4. **CHECKPOINT — Kill dev server.** After ALL review agents (Phase 1 + Phase 2) complete AND hard gate evaluation is done: `kill $DEV_PID 2>/dev/null || true`. This is a mandatory step — do not defer to STATE 7.

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

### Agent Efficiency Directives

Include these directives in every agent spawn prompt (Phase 1 and Phase 2):

1. **Batch searches**: Use Grep with glob patterns (e.g., `glob: "src/**/*.tsx"`) instead of reading files one by one.
2. **PR-changed files first**: Check files from `git diff --name-only $(git merge-base HEAD main)...HEAD` before scanning the full source tree.
3. **Context digest**: Include the context digest summary (pages, behavior IDs, event names, golden_path steps) extracted in STATE 0 so agents don't need to re-read experiment.yaml.
4. **Pre-existing changes**: Edit-capable agents (design-critic, ux-journeyer, security-fixer) should ignore pre-existing uncommitted changes that are outside the PR file boundary.

> **Template enforcement:** Read `.claude/agent-prompt-footer.md` and append its full content
> to every agent spawn prompt (Phase 1 and Phase 2). The phase-transition-gate hook checks
> for the directive marker in agent prompts.

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

### Trace State Detection

After each agent returns, check `.claude/agent-traces/<name>.json`:

| State | Condition | Meaning |
|-------|-----------|---------|
| 1 | File does not exist | Agent never started |
| 1 | File exists but `run_id` doesn't match verify-context.json | Stale trace from prior run |
| 2 | File exists, `"status":"started"`, no `"verdict"` | Agent exhausted turns |
| 3 | File exists, has `"verdict"` | Agent completed |

Detection command:
```bash
verdict=$(python3 -c "
import json, os
f = '.claude/agent-traces/<name>.json'
ctx_f = '.claude/verify-context.json'
if not os.path.exists(f):
    print('NO_FILE')
else:
    d = json.load(open(f))
    # Check run_id freshness
    trace_run_id = d.get('run_id', '')
    if trace_run_id and os.path.exists(ctx_f):
        ctx = json.load(open(ctx_f))
        ctx_run_id = ctx.get('run_id', '')
        if ctx_run_id and trace_run_id != ctx_run_id:
            print('STALE')  # Trace from a prior run
        else:
            print(d.get('verdict', 'MISSING'))
    else:
        # No run_id in trace — backward compat, treat as current
        print(d.get('verdict', 'MISSING'))
" 2>/dev/null || echo "NO_FILE")
```
- `NO_FILE` → state 1 (agent never started)
- `STALE` → state 1 (trace from prior run — treat as if agent never started)
- `MISSING` → state 2 (agent exhausted turns — started trace only)
- Any other value → state 3 (agent completed normally)

Use this algorithm for all trace checks below and in the Exhaustion Protocol.

### Recovery traces

After all Phase 1 agents return, use Trace State Detection to check each spawned agent's trace in `.claude/agent-traces/<name>.json`.

If an agent returned output but crashed before writing its trace, write a recovery trace:

```bash
echo '{"agent":"<name>","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"<agent-verdict>","checks_performed":<agent-checks-array>,"recovery":true}' > .claude/agent-traces/<name>.json
```

The `checks_performed` array must match the agent's specification (see each agent's Trace Output section). The `"recovery":true` flag marks this as a lead-written trace — gate-keeper will WARN on recovery traces.

Do NOT write traces for agents that were not spawned. Do NOT write traces for agents whose output you never received.

### Exhaustion Protocol

When an agent returns but its trace has `"status":"started"` and no `"verdict"` field (Trace State 2), it exhausted its turn budget before completing work. Handle by tier:

| Tier | Agents | Action | On Double Exhaustion |
|------|--------|--------|---------------------|
| 1 | design-critic, ux-journeyer, security-fixer | Retry once (focused scope) | Hard gate failure, skip remaining STATEs |
| 2 | behavior-verifier, security-attacker, security-defender, design-consistency-checker | Retry once | Recovery trace with `"status":"exhausted"`, WARN, continue |
| 3 | build-info-collector, observer, performance-reporter, accessibility-scanner, spec-reviewer | No retry | Recovery trace with `"status":"exhausted"`, WARN, continue |

#### Tier 1 — Critical edit-capable agents

**Detection**: Trace State 2 after agent returns.

**Action**: Before re-spawning, execute Atomic Execution Protocol revert (see STATE 3). Agent traces are NOT reverted.

Then mark the retry in the trace:

**If trace exists (State 2):**
```bash
python3 -c "
import json
f = '.claude/agent-traces/<name>.json'
d = json.load(open(f))
d['retry_attempted'] = True
json.dump(d, open(f, 'w'))
"
```

**If trace does NOT exist (State 1 — NO_FILE or STALE):**
```bash
RUN_ID=$(python3 -c "import json;print(json.load(open('.claude/verify-context.json')).get('run_id',''))" 2>/dev/null || echo "")
echo '{"agent":"<name>","status":"exhausted","retry_attempted":true,"original_state":"NO_FILE","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","run_id":"'"$RUN_ID"'"}' > .claude/agent-traces/<name>.json
```

Re-spawn the agent with a reduced scope prompt:
- design-critic: "Focus on the lowest-scoring page only. Skip pages that already score ≥8."
- ux-journeyer: "Focus on the primary golden path only. Skip secondary journeys."
- security-fixer: "Fix only Critical severity issues. Skip High/Medium."

**On double exhaustion** (retry also produces State 2):
1. Write a recovery trace: `{"agent":"<name>","status":"exhausted","verdict":"exhausted","recovery":true,"retry_attempted":true,"checks_performed":[],"timestamp":"..."}`
2. Set `hard_gate_failure: true` in the verify report frontmatter
3. Skip operational STATEs 4-6 (jump to STATE 7, then continue to STATE 8)
4. Report to user: "Agent <name> exhausted turns twice. Hard gate failure — manual review required."

#### Tier 2 — Critical read-only agents

**Detection**: Trace State 2 after agent returns.

**Action**: Re-spawn the agent once with the same prompt.

**On double exhaustion**:
1. Write a recovery trace: `{"agent":"<name>","status":"exhausted","verdict":"incomplete","recovery":true,"checks_performed":[],"timestamp":"..."}`
2. Continue to next STATE — this is a WARN, not a BLOCK
3. Note in verify report: "Agent <name> exhausted turns — results incomplete."

#### Tier 3 — Non-critical agents

**Detection**: Trace State 2 after agent returns.

**Action**: No retry. Write a recovery trace immediately:
```bash
echo '{"agent":"<name>","status":"exhausted","verdict":"incomplete","recovery":true,"checks_performed":[],"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .claude/agent-traces/<name>.json
```

Continue to next STATE. Note in verify report: "Agent <name> exhausted turns — skipped."

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

### Atomic Execution Protocol

Before each edit-capable agent spawn, snapshot the working tree:

```bash
git diff --name-only > /tmp/pre-agent-snapshot.txt
```

After an agent returns with Trace State 2 (exhausted), revert **source** changes only — preserve `.claude/` artifacts:

```bash
git diff --name-only > /tmp/post-agent-snapshot.txt
AGENT_CHANGED=$(comm -13 <(sort /tmp/pre-agent-snapshot.txt) <(sort /tmp/post-agent-snapshot.txt))
for f in $AGENT_CHANGED; do
  case "$f" in
    .claude/*) ;;  # Keep traces and artifacts
    *) git checkout -- "$f" 2>/dev/null || rm -f "$f" ;;
  esac
done
```

For per-page design-critic: only revert the **exhausted page's** files. Keep completed pages' changes.

If the agent completes normally (Trace State 3 with verdict), do NOT revert — its changes are accepted.

### design-critic (if scope is `full` or `visual`, AND archetype is `web-app`) — PARALLEL PER PAGE

#### Stage 1: Per-page review (parallel)

Discover **all** pages — not just golden_path pages:

1. Scan the filesystem for all page files:
   ```bash
   find src/app -name 'page.tsx' -o -name 'page.jsx' -o -name 'page.ts' -o -name 'page.js' 2>/dev/null | grep -v '/api/' | sort
   ```
2. Read `golden_path` pages from experiment.yaml for route metadata.
3. Merge: for each discovered page file, derive the route from its path (e.g., `src/app/settings/page.tsx` → `/settings`). Golden_path entries provide the canonical page name; filesystem-only pages use the directory name as the page name.
4. Deduplicate by route. The final list is the **union** of golden_path pages and filesystem pages.

Spawn **one design-critic agent per page**, ALL as parallel foreground Agent calls in a **SINGLE message**. Each agent prompt includes:
- Page name and route: "Review SINGLE page: `<page_name>` at route `<route>`."
- `base_url`: `http://localhost:3000` (from Dev Server Preamble)
- `run_id`: from verify-context.json
- Per-page file boundary: `PR_file_boundary ∩ src/app/<page>/**` — shared paths (`src/components/**`, `src/lib/**`) are explicitly EXCLUDED from per-page agents. Pass ONLY page-local files.
- Context digest summary
- Instruction to write trace as `design-critic-<page_name>.json`

**Wait for all per-page agents to complete.**

After completion: use Trace State Detection to check each `design-critic-<page_name>.json`. If any agent is State 2 (exhausted), follow Exhaustion Protocol Tier 1 with reduced scope: "Focus on this page only." If State 1 (never started) and agent returned output, write a recovery trace.

#### Stage 1b: Orchestrator shared-component fixes (serial)

After all per-page agents complete AND before Stage 2 (consistency check):

1. Read each per-page trace. If any trace output mentions shared-component issues without fixing them (shared paths were excluded from boundary), the orchestrator applies those fixes serially, one file at a time.
2. Run `npm run build` after shared-component fixes. If build fails, fix (max 2 attempts).
3. Append each fix to `.claude/fix-log.md`: `Fix (design-critic-shared): <file> — <desc>`
4. If no shared-component issues reported: this step is a no-op.

#### Stage 2: Consistency check + merge

##### Step A: Lead merges per-page traces

Before spawning the consistency checker, the lead merges per-page traces into `design-critic.json`:

```bash
python3 -c "
import json, glob, os
batches = sorted(glob.glob('.claude/agent-traces/design-critic-*.json'))
if not batches:
    exit(1)
run_id = ''
try:
    run_id = json.load(open('.claude/verify-context.json')).get('run_id', '')
except:
    pass
merged = {'agent': 'design-critic', 'pages_reviewed': 0, 'min_score': 10, 'verdict': 'pass',
          'checks_performed': [], 'pages': len(batches), 'consistency_fixes': 0,
          'sections_below_8': 0, 'fixes_applied': 0, 'unresolved_sections': 0,
          'min_score_all': 10, 'pre_existing_debt': [], 'fixes': [], 'run_id': run_id}
worst_verdicts = {'unresolved': 3, 'fixed': 2, 'pass': 1}
for b in batches:
    d = json.load(open(b))
    merged['pages_reviewed'] += d.get('pages_reviewed', 1)
    merged['min_score'] = min(merged['min_score'], d.get('min_score', 10))
    merged['min_score_all'] = min(merged['min_score_all'], d.get('min_score_all', 10))
    merged['checks_performed'].extend(d.get('checks_performed', []))
    merged['sections_below_8'] += d.get('sections_below_8', 0)
    merged['fixes_applied'] += d.get('fixes_applied', 0)
    merged['unresolved_sections'] += d.get('unresolved_sections', 0)
    debt = d.get('pre_existing_debt', [])
    if isinstance(debt, list):
        merged['pre_existing_debt'].extend(debt)
    page_fixes = d.get('fixes', [])
    if isinstance(page_fixes, list):
        merged['fixes'].extend(page_fixes)
    bv = d.get('verdict', 'pass')
    if worst_verdicts.get(bv, 0) > worst_verdicts.get(merged['verdict'], 0):
        merged['verdict'] = bv
        merged['weakest_page'] = d.get('weakest_page', d.get('page', ''))
    if d.get('retry_attempted'):
        merged['retry_attempted'] = True
import datetime
merged['timestamp'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump(merged, open('.claude/agent-traces/design-critic.json', 'w'))
"
```

> **Do NOT delete per-page traces** — the consistency checker needs them for cross-page comparison.

##### Step B: Spawn consistency checker (cross-page visual review only)

Spawn the `design-consistency-checker` agent (`subagent_type: design-consistency-checker`). It reads per-page traces and screenshots all pages for cross-page consistency — but does NOT merge traces or fix code.

Pass:
- `base_url`: `http://localhost:3000`
- `run_id`: from verify-context.json
- List of pages reviewed

**Wait for completion.** Handle exhaustion per Tier 2.

#### Post-design-critic lint gate

After ALL per-page agents + Stage 1b + Stage 2 (consistency check) complete:

1. Run: `npm run build && npm run lint`
2. If lint errors (not warnings):
   - Fix unused imports (max 2 attempts) — this is the most common issue after multi-agent edits
   - Append each fix to `.claude/fix-log.md`: `Fix (lint-gate): <file> — removed unused import`
3. If build errors: fix (max 2 attempts), append to fix-log
4. Re-run `npm run build && npm run lint` to confirm clean.

> **Downstream compatibility**: phase-transition-gate.sh and gate-keeper BG3 check the merged `design-critic.json` — no changes needed. `agents_completed` still lists `"design-critic"` (singular).

#### Lead-side validation (design-critic)

1. Read `.claude/agent-traces/design-critic.json` trace (merged by consistency checker).
2. Verify `pages_reviewed` >= number of discovered pages (filesystem + golden_path union).
3. If `verdict` == `"unresolved"`, this is a **hard gate failure** — design quality threshold (8/10) was not met after 2 fix attempts. Skip STATEs 4-6 but still write verify-report.md (STATE 7) and execute STATE 8 (Save Patterns). Report failure to user with the `unresolved_sections` count.
4. If `min_score` < 8 and `verdict` == `"fixed"`, note in verify report that threshold was met after fixes.
5. If `pre_existing_debt` is non-empty, note pre-existing quality debt in verify report (informational, does not block).
6. Extract Fix Summaries from per-page agent return messages. Append each fix to `.claude/fix-log.md` with the prefix `Fix (design-critic):`.
7. Note `pages` count and `consistency_fixes` count in verify report.

### ux-journeyer (if scope is `full` or `visual`, AND archetype is `web-app`) — SERIAL

Spawn the `ux-journeyer` agent (`subagent_type: ux-journeyer`). Pass PR file boundary. **Wait for completion.**
After completion: verify `.claude/agent-traces/ux-journeyer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.
Run `npm run build`. If build fails, fix (max 2 attempts) before next agent.

#### Lead-side validation (ux-journeyer)

1. Read `.claude/agent-traces/ux-journeyer.json` trace.
2. If `verdict` == `"blocked"`, this is a **hard gate failure** — the golden path cannot be completed. Stop and report the blocked location to the user. Do NOT proceed to STATE 4.
3. If `unresolved_dead_ends` > 0, this is a **hard gate failure** — real dead ends remain after fixes. Skip STATEs 4-6 but still write verify-report.md (STATE 7) and execute STATE 8 (Save Patterns).
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

> **Hook-enforced:** `phase-transition-gate.sh` validates STATE 3 postconditions before allowing security-fixer to spawn.

**NEXT:** STATE 4

---

## STATE 4: SECURITY_MERGE_FIX

**PRECONDITIONS:** STATE 3 complete.

**Always write** `.claude/security-merge.json` — this is a metadata artifact, not an operational step:

- If security agents ran: merge Defender FAILs + Attacker findings (see below)
- If security agents did NOT run (scope `visual` or `build`): write `{"findings":[],"source":"no-security-agents","run_id":"<run_id>"}`
- If hard gate fired in STATE 3: write full merge + `"fixer_skipped":true,"reason":"hard_gate_failure"`

If security agents were not spawned OR hard gate failure occurred, skip security-fixer spawn and proceed to STATE 5.

**ACTIONS:**

### Merge Security Results (if scope is `full` or `security`)

Run the automated security merge script:

```bash
python3 -c "
import json, os
traces = '.claude/agent-traces'
ctx = json.load(open('.claude/verify-context.json'))
run_id = ctx.get('run_id', '')

defender = json.load(open(os.path.join(traces, 'security-defender.json')))
attacker = json.load(open(os.path.join(traces, 'security-attacker.json')))

d_fails = defender.get('fails', [])
a_findings = attacker.get('findings', [])

# Backward compat: block if structured arrays missing but counts > 0
if not d_fails and defender.get('fails_count', 0) > 0:
    raise ValueError('security-defender trace missing fails array — update agent definition')
if not a_findings and attacker.get('findings_count', 0) > 0:
    raise ValueError('security-attacker trace missing findings array — update agent definition')

# Deduplicate: same file + same desc -> keep attacker finding
seen = set()
merged = []
for f in a_findings:
    key = (f.get('file',''), f.get('desc',''))
    seen.add(key)
    merged.append({**f, 'source': 'attacker'})
for f in d_fails:
    key = (f.get('file',''), f.get('desc',''))
    if key not in seen:
        merged.append({**f, 'source': 'defender'})

result = {
    'timestamp': __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'defender_fails': defender.get('fails_count', 0),
    'attacker_findings': attacker.get('findings_count', 0),
    'merged_issues': len(merged),
    'issues': merged,
    'run_id': run_id
}
json.dump(result, open('.claude/security-merge.json', 'w'))
print(f'Security merge: {result[\"defender_fails\"]} defender FAILs + {result[\"attacker_findings\"]} attacker findings -> {result[\"merged_issues\"]} merged issues')
"
```

### security-fixer (if merged security has issues)

Before spawning, execute the Atomic Execution Protocol snapshot (see STATE 3):

```bash
git diff --name-only > /tmp/pre-agent-snapshot.txt
```

Spawn the `security-fixer` agent (`subagent_type: security-fixer`).
Pass: merged Defender table + Attacker findings.

**Wait for the fixer to complete before continuing.**

If agent returns with Trace State 2 (exhausted), execute the Atomic Execution Protocol revert before retrying (see STATE 3 and Exhaustion Protocol Tier 1).

After security-fixer completes: verify `.claude/agent-traces/security-fixer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.

After each fix, append to `.claude/fix-log.md`.

#### Lead-side validation (security-fixer)

1. Read `.claude/agent-traces/security-fixer.json` trace.
2. If `verdict` == `"partial"` AND `unresolved_critical` > 0, this is a **hard gate failure** — Critical/High security issues or Defender FAILs remain unfixed after 2 fix cycles. Skip STATEs 5-6 but still write verify-report.md (STATE 7) and execute STATE 8 (Save Patterns). Report failure to user with the unresolved items.
3. If trace has `"recovery": true` AND `verdict` == `"partial"`, treat as hard gate failure (recovery traces cannot confirm fixes succeeded).
4. Extract Fix Summaries from the agent's return message. Append each fix to `.claude/fix-log.md` with the prefix `Fix (security-fixer):`.

**POSTCONDITIONS:** `security-merge.json` exists. Security-fixer trace exists (if spawned). If security-fixer verdict is `"partial"` with `unresolved_critical` > 0, pipeline is halted.

**VERIFY:**
```bash
test -f .claude/security-merge.json
```

> **Hook-enforced:** `phase-transition-gate.sh` validates STATE 4 postconditions before allowing observer to spawn.

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

- Otherwise: run E2E tests with precondition separation.

  **Phase A: Config validation (max 2 attempts, NOT counted against test budget)**

  1. Run: `timeout 30 npx playwright test --list 2>&1`
  2. If `--list` succeeds (exit 0, lists test names): proceed to Phase B.
  3. If config error (output contains `browserType`, `chromium`, `Cannot find module`, `config`, or `Error: playwright`):
     - These are infrastructure issues, not test failures.
     - Fix the config error (e.g., install missing browser, fix config path).
     - Append fix to `.claude/fix-log.md`: `Fix (e2e-config): <file> — <description>`
     - Re-run `--list` (max 2 config-fix attempts total).
  4. If test file error (syntax errors in test files, missing imports in tests): proceed to Phase B — these count against the test budget.
  5. If config errors persist after 2 attempts, write `.claude/e2e-result.json`:
     ```bash
     echo '{"passed":false,"attempts":0,"config_error":true,"reason":"playwright config broken after 2 fix attempts"}' > .claude/e2e-result.json
     ```
     Skip to STATE 6.

  **Phase B: Test execution (3-attempt budget, starts ONLY after --list succeeds)**

  For each failed attempt:
  1. Read test output, identify failures
  2. Fix issues (test code or app code)
  3. Append each fix to `.claude/fix-log.md`: `Fix (e2e): <file> — <description>`
  4. Re-run tests

  After tests pass (or 3-attempt budget exhausted), write `.claude/e2e-result.json`:
  ```bash
  cat > .claude/e2e-result.json << 'E2EEOF'
  {"passed":<true|false>,"attempts":<N>,"fixes":<N>,"config_attempts":<CA>}
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

1. Collect targeted diffs automatically:

```bash
python3 -c "
import re, subprocess, os, json
fixes = open('.claude/fix-log.md').read()
files = sorted(set(re.findall(r'\x60([^\x60]+\.(?:ts|tsx|js|jsx|json|css))\x60', fixes)))
diffs = []
for f in files:
    r = subprocess.run(['git', 'diff', 'HEAD', '--', f], capture_output=True, text=True)
    if r.stdout.strip():
        diffs.append(f'=== {f} ===\n{r.stdout}')
    elif os.path.exists(f):
        r2 = subprocess.run(['git', 'diff', '--no-index', '/dev/null', f], capture_output=True, text=True)
        if r2.stdout.strip():
            diffs.append(f'=== {f} (new file) ===\n{r2.stdout}')
with open('.claude/observer-diffs.txt', 'w') as out:
    out.write('\n'.join(diffs) if diffs else '(no diffs captured)')
print(f'Collected diffs for {len(diffs)} files -> .claude/observer-diffs.txt')
"
```

2. Spawn the `observer` agent (`subagent_type: observer`).
   Pass ONLY: content of `.claude/observer-diffs.txt` + Fix Log summaries + template file list.
   Do NOT include experiment.yaml content, project name, or feature descriptions.
   Get template file list (from build-info-collector, or generate now:
   run `find .claude/stacks .claude/commands .claude/patterns scripts -type f 2>/dev/null`
   and add `Makefile` and `CLAUDE.md`).
3. Report the observer's result.
4. Verify `.claude/agent-traces/observer.json` exists; if agent returned output but trace is missing, write a recovery trace with `"recovery":true`.

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

Before writing the report, extract agent verdicts from traces:

```bash
AGENT_VERDICTS=$(python3 -c "
import json, glob
verdicts = {}
for f in glob.glob('.claude/agent-traces/*.json'):
    name = f.split('/')[-1].replace('.json','')
    d = json.load(open(f))
    verdicts[name] = d.get('verdict', 'missing')
print(json.dumps(verdicts))
" 2>/dev/null || echo "{}")
```

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
agent_verdicts: <AGENT_VERDICTS JSON>
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

If `.claude/fix-log.md` has only the header line and no entries, this state is a no-op — write `.claude/patterns-saved.json` with `{"saved":0,"skipped":0,"total":0,"saved_to_files":[],"saved_to_memory":0}` and return.

**ACTIONS:**

Read `.claude/fix-log.md` from disk. If it has only the header line and no entries, write
`{"saved":0,"skipped":0,"total":0,"saved_to_files":[],"saved_to_memory":0}` to
`.claude/patterns-saved.json` and skip to Done.

If the Fix Log has entries:

1. Spawn the `pattern-classifier` agent (`subagent_type: pattern-classifier`).
   Pass: fix-log.md content, list of stack files (`find .claude/stacks -type f`), project memory directory path.
2. Wait for completion.
3. Verify `.claude/patterns-saved.json` exists (the hook validates invariants automatically).

**POSTCONDITIONS:** `patterns-saved.json` exists. Pattern count matches fix log entry count.

**VERIFY:**
```bash
test -f .claude/patterns-saved.json
```

**NEXT:** Done — return to calling skill.
