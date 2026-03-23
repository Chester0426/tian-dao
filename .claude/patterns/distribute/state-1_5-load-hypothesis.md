# STATE 1_5: LOAD_HYPOTHESIS

**PRECONDITIONS:**
- Preconditions validated (STATE 1 POSTCONDITIONS met)

**ACTIONS:**

If `.claude/spec-manifest.json` exists, read it and extract:
- All hypotheses where `category` is `"demand"` or `"reach"` (the categories relevant to distribution)
- For each: `statement`, `metric.formula`, `metric.threshold`

Store as hypothesis context for Step 3. If the file does not exist, skip — all subsequent steps work without it.

**POSTCONDITIONS:**
- If `.claude/spec-manifest.json` exists: demand/reach hypotheses extracted and stored in context
- If `.claude/spec-manifest.json` does not exist: skipped, no hypothesis context

**VERIFY:**
```bash
test -f .claude/spec-manifest.json && echo "spec-manifest found — hypotheses loaded" || echo "spec-manifest not found — skipped (OK)"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh distribute 1_5
```

**NEXT:** Read [state-2-research-targeting.md](state-2-research-targeting.md) to continue.
