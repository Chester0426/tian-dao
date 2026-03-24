# STATE 1: PLAN

**PRECONDITIONS:**
- Context read (STATE 0 POSTCONDITIONS met)
- `hosting.provider`, `canonical_url`, and rollback procedure are known

**ACTIONS:**

Identify the rollback target. Present the rollback plan to the user:

```
## Rollback Plan

**Provider:** <provider>
**Target:** <canonical_url>
**Action:** <rollback command or dashboard steps from hosting stack file>

Warning: This will revert the hosting deployment only.
     Database migrations are NOT rolled back.
     Environment variable changes are NOT rolled back.

Proceed with rollback?
```

**POSTCONDITIONS:**
- Rollback plan has been presented to the user with provider, target URL, and action

**VERIFY:**
```bash
echo "Plan presented to user"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh rollback 1
```

**NEXT:** Read [state-2-user-approval.md](state-2-user-approval.md) to continue.
