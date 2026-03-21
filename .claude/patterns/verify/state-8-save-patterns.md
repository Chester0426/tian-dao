# STATE 8: SAVE_PATTERNS

**PRECONDITIONS:** STATE 7 complete.

If `.claude/fix-log.md` has only the header line and no entries, this state is a no-op — write `.claude/patterns-saved.json` with `{"saved":0,"skipped":0,"total":0,"saved_to_files":[],"saved_to_memory":0}` and return.

**ACTIONS:**

Read `.claude/fix-log.md` from disk. If it has only the header line and no entries, write
`{"saved":0,"skipped":0,"total":0,"saved_to_files":[],"saved_to_memory":0}` to
`.claude/patterns-saved.json` and skip to Done.

If the Fix Log has entries:

1. Spawn the `pattern-classifier` agent (`subagent_type: pattern-classifier`).
   Pass: fix-log.md content, list of stack files (`find .claude/stacks -type f`), project memory directory path.
2. Wait for completion.
3. Verify `.claude/patterns-saved.json` exists (the hook validates invariants automatically).

**POSTCONDITIONS:** `patterns-saved.json` exists. Pattern count matches fix log entry count.

**VERIFY:**
```bash
test -f .claude/patterns-saved.json
```

**NEXT:** Done — return to calling skill.
