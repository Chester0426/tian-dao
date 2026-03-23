# STATE 8: FINAL_VALIDATION

**PRECONDITIONS:**
- Fixes implemented (STATE 7 POSTCONDITIONS met)

**ACTIONS:**

- Run all 3 validators
- Record `final_errors`
- If `final_errors` > 0 for checks that passed before Step 7: stop and report regression

**POSTCONDITIONS:**
- All 3 validators run
- `final_errors` recorded
- No regressions (no new failures for checks that passed before Step 7)

**VERIFY:**
```bash
python3 scripts/validate-frontmatter.py 2>&1 | tail -1
python3 scripts/validate-semantics.py 2>&1 | tail -1
bash scripts/consistency-check.sh 2>&1 | tail -1
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh resolve 8
```

**NEXT:** Read [state-8b-side-effect-scan.md](state-8b-side-effect-scan.md) to continue.
