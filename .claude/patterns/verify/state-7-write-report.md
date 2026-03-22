# STATE 7: WRITE_REPORT

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
hard_gate_failure: false
process_violation: false
overall_verdict: pass | fail
---

## Build
- Attempts: [N]/3
- Result: pass
- Last output: [last 3-5 lines of build output]

## Quality Delta
> Populated when `.claude/verify-history.jsonl` has a previous entry. Otherwise omit this section.
>
> Read the last line of `.claude/verify-history.jsonl` and compare to current run values.

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Build attempts | [prev] | [curr] | [+/-N or —] |
| Fix log entries | [prev] | [curr] | [+/-N or —] |
| Overall verdict | [prev] | [curr] | [improved/regressed/—] |

## Review Agents
| Agent | Verdict | Notes |
|-------|---------|-------|
| design-critic | [pass/fixed/skipped] | [1-line summary] |
| design-critic-shared | [fixed/skipped/N/A] | [shared component fixes, or "no shared issues"] |
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

> **Default fields:** The `hard_gate_failure: false` and `process_violation: false` fields are always present in the template. Set them to `true` when the relevant conditions are triggered (see below). The verify-report-gate hook validates their presence unconditionally.

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

6. Compute `overall_verdict`: if `hard_gate_failure` is `true` OR `process_violation` is `true` → `fail`, otherwise → `pass`. Write this into the frontmatter.

7. Append to `.claude/verify-history.jsonl` (persistent across runs — never deleted):
   ```bash
   python3 -c "
   import json, datetime
   ctx = json.load(open('.claude/verify-context.json'))
   report = open('.claude/verify-report.md').read()
   lines = report.split('\n')
   fm = {}
   in_fm = False
   for line in lines:
       s = line.strip()
       if s == '---':
           if in_fm: break
           in_fm = True; continue
       if in_fm and ':' in s:
           k, v = s.split(':', 1)
           fm[k.strip()] = v.strip()
   entry = {
       'timestamp': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
       'run_id': ctx.get('run_id', ''),
       'scope': ctx.get('scope', ''),
       'archetype': ctx.get('archetype', ''),
       'build_attempts': int(fm.get('build_attempts', '1')),
       'fix_log_entries': int(fm.get('fix_log_entries', '0')),
       'hard_gate_failure': fm.get('hard_gate_failure', 'false') == 'true',
       'process_violation': fm.get('process_violation', 'false') == 'true',
       'overall_verdict': fm.get('overall_verdict', 'pass').strip()
   }
   with open('.claude/verify-history.jsonl', 'a') as f:
       f.write(json.dumps(entry) + '\n')
   print('Appended to verify-history.jsonl')
   "
   ```

**POSTCONDITIONS:** `verify-report.md` exists with valid frontmatter. `verify-history.jsonl` has a new entry appended.

**VERIFY:**
```bash
head -1 .claude/verify-report.md | grep -q '^---$' && tail -1 .claude/verify-history.jsonl | python3 -c "import json,sys;json.loads(sys.stdin.read());print('ok')"
```

**NEXT:** Read [state-8-save-patterns.md](state-8-save-patterns.md) to continue.
