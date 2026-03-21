# STATE 3: PHASE2_SERIAL

**PRECONDITIONS:** All Phase 1 traces exist (hook-enforced by `phase-transition-gate.sh`).

**ACTIONS:**

Spawn edit-capable agents ONE AT A TIME. Each must complete and pass `npm run build` before the next is spawned. This prevents write conflicts.

After each edit-capable agent completes, read its completion report and append its fixes to `.claude/fix-log.md`.

> **Shared algorithms:** Before each edit-capable agent spawn, execute [Atomic Execution Protocol](../verify.md#atomic-execution-protocol) snapshot. After each agent returns, use [Trace State Detection](../verify.md#trace-state-detection) and [Exhaustion Protocol](../verify.md#exhaustion-protocol) to handle the result.

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
- `base_url`: `http://localhost:3000` (from [Dev Server Preamble](../verify.md#dev-server-preamble-if-archetype-is-web-app))
- `run_id`: from verify-context.json
- Per-page file boundary with structured marker. Compute `PR_file_boundary ∩ src/app/<page>/**` — shared paths (`src/components/**`, `src/lib/**`) are explicitly EXCLUDED from per-page agents. Pass ONLY page-local files. Include in the prompt as a machine-parseable block:
  ```
  FILE_BOUNDARY_START
  src/app/<page>/page.tsx
  src/app/<page>/<page>-content.tsx
  FILE_BOUNDARY_END
  ```
  > **Hook-enforced:** `phase-transition-gate.sh` validates that no shared paths appear between these markers. The hook will BLOCK the agent spawn if shared paths are detected.
- Context digest summary
- Instruction to write trace as `design-critic-<page_name>.json`

**Wait for all per-page agents to complete.**

After completion: use [Trace State Detection](../verify.md#trace-state-detection) to check **each** `design-critic-<page_name>.json` individually. If any agent is State 2 (exhausted), follow [Exhaustion Protocol](../verify.md#exhaustion-protocol) Tier 1 with reduced scope: "Focus on this page only." If State 1 (never started) and agent returned output, write a recovery trace.

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
with open('.claude/agent-traces/design-critic.json', 'w') as f:
    json.dump(merged, f)
"
```

> **Do NOT delete per-page traces** — the consistency checker needs them for cross-page comparison.

##### Step B: Spawn consistency checker (cross-page visual review only)

Spawn the `design-consistency-checker` agent (`subagent_type: design-consistency-checker`). It reads per-page traces and screenshots all pages for cross-page consistency — but does NOT merge traces or fix code.

Pass:
- `base_url`: `http://localhost:3000`
- `run_id`: from verify-context.json
- List of pages reviewed

**Wait for completion.** Handle exhaustion per [Exhaustion Protocol](../verify.md#exhaustion-protocol) Tier 2.

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

1. Read `.claude/agent-traces/design-critic.json` trace (merged by lead in Step A).
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

**NEXT:** Read [state-4-security-merge-fix.md](state-4-security-merge-fix.md) to continue.
