# STATE 4: BLAST_RADIUS

**PRECONDITIONS:**
- Reproduction complete (STATE 3 POSTCONDITIONS met)

**ACTIONS:**

The bug pattern found in Step 3 may exist in other template files:

1. Identify the pattern that caused the issue (e.g., missing archetype check,
   hardcoded path, missing conditional)
2. Grep all template files for the same pattern:
   ```bash
   # Search commands, stacks, patterns, procedures, agents
   rg "<pattern>" .claude/ scripts/ Makefile CLAUDE.md
   ```
3. For each match: evaluate whether it has the same bug. Record matches as
   `blast_radius` entries with file:line and whether they are confirmed
   (same bug) or potential (similar pattern, different context)

**POSTCONDITIONS:**
- Each actionable issue has a `blast_radius` list
- Each entry has file:line and classification (confirmed or potential)

**VERIFY:**
```bash
# Blast radius analysis complete for all actionable issues
echo "Blast radius recorded"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh resolve 4
```

**NEXT:** If 2+ actionable issues remain, read [state-4b-root-cause-clustering.md](state-4b-root-cause-clustering.md). Otherwise, read [state-5-fix-design.md](state-5-fix-design.md) to continue.
