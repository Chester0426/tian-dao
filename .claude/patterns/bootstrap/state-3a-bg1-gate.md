# STATE 3a: BG1_GATE

**PRECONDITIONS:**
- All validations pass (STATE 3 POSTCONDITIONS met)

**ACTIONS:**

Spawn the `gate-keeper` agent (`subagent_type: gate-keeper`). Pass: "Execute BG1 Validation Gate. Read experiment/experiment.yaml and verify: all required fields present and non-empty, name is lowercase-hyphen, no TODO values, archetype-specific field present, stack dependency rules (payment->auth+db, email->auth+db), quality:production->testing, variants restricted to web-app archetype, variants structure if present."

If gate-keeper returns BLOCK, stop and report — do NOT proceed until validation passes.

**POSTCONDITIONS:**
- BG1 Validation Gate verdict is PASS

**VERIFY:**
```bash
# Gate-keeper returned **Verdict: PASS**
echo "BG1 gate verdict confirmed"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh bootstrap 3a
```

**NEXT:** Read [state-3b-duplicate-check.md](state-3b-duplicate-check.md) to continue.
