# STATE 6: AUTO_OBSERVE

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

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh verify 6
```

**NEXT:** Read [state-7-write-report.md](state-7-write-report.md) to continue.
