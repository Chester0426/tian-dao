# STATE 2: USER_APPROVAL

**PRECONDITIONS:**
- Plan presented (STATE 1 POSTCONDITIONS met)

**ACTIONS:**

**STOP.** End your response here. Wait for user approval before continuing.

DO NOT proceed to STATE 3 until the user explicitly replies with approval.
If the user requests changes or asks questions, address their concerns and present the plan again (return to STATE 1). Repeat until approved.

**POSTCONDITIONS:**
- User has explicitly approved the rollback

**VERIFY:**
```bash
# User message contains approval (e.g., "yes", "proceed", "do it", "approve")
echo "User approval received"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh rollback 2
```

**NEXT:** Read [state-3-execute.md](state-3-execute.md) to continue.
