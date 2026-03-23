# STATE 11: SKILL_EPILOGUE

**PRECONDITIONS:**
- Patterns saved (STATE 10 POSTCONDITIONS met)

**ACTIONS:**

Follow `.claude/patterns/skill-epilogue.md` to evaluate template observation.
This runs the observer agent if fixes were logged in `.claude/fix-log.md`,
or records "clean" if not. The epilogue must complete before the final commit
(`observe-commit-gate.sh` enforces this).

**POSTCONDITIONS:**
- Skill epilogue complete
- Observer agent run (if fixes were logged) or "clean" recorded

**VERIFY:**
```bash
# Epilogue complete
echo "Skill epilogue complete"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh resolve 11
```

**NEXT:** This is the TERMINAL state. The /resolve skill is complete.
