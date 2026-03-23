# STATE 2b: FILTER_FINDINGS

**PRECONDITIONS:**
- Review scan complete (STATE 2a POSTCONDITIONS met)
- Deduplicated findings collected

**ACTIONS:**

- A finding signature = `<file_path>:<finding_title>`
- Remove findings whose signatures match `seen_findings` set (oscillation guard)
- If 0 remaining findings -> **exit loop**, proceed to State 3
- Add new signatures to `seen_findings`

**POSTCONDITIONS:**
- Findings filtered against `seen_findings`
- New signatures added to `seen_findings`
- If 0 remaining: loop exit triggered

**VERIFY:**
Each remaining finding has a unique signature not in the prior `seen_findings` set.

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh review 2b
```

**NEXT:** If 0 remaining findings, read [state-3-update-inventory.md](state-3-update-inventory.md). Otherwise, read [state-2c-adversarial-validation.md](state-2c-adversarial-validation.md) to continue.
