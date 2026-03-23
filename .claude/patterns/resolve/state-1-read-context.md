# STATE 1: READ_CONTEXT

**PRECONDITIONS:**
- `issue_list` is populated (STATE 0 POSTCONDITIONS met)

**ACTIONS:**

- Read `CLAUDE.md`
- Read `scripts/check-inventory.md`
- For each issue in `issue_list`: read every template file mentioned in the issue body

**POSTCONDITIONS:**
- `CLAUDE.md` and `scripts/check-inventory.md` have been read
- All template files cited in issue bodies have been read
- Their contents are in context for subsequent states

**VERIFY:**
```bash
test -f CLAUDE.md && test -f scripts/check-inventory.md && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh resolve 1
```

**NEXT:** Read [state-2-triage.md](state-2-triage.md) to continue.
