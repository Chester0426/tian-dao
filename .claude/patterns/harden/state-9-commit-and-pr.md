# STATE 9: COMMIT_AND_PR

**PRECONDITIONS:**
- STATE 8 POSTCONDITIONS met (verification complete, report exists)

**ACTIONS:**

**Gate check:** Read `.claude/verify-report.md`. If it does not exist, STOP -- go back and run STATE 8 above. Do NOT commit without a verification report.

Commit, push, open PR. Populate the PR Verification checklist from `.claude/verify-report.md` contents. After the PR is created, delete `.claude/current-plan.md` and `.claude/verify-report.md`.

Key design decisions:
- Dependency-ordered sequential execution -- fail-fast prevents cascading breakage, dependencies satisfied before dependents
- Implementer agents use `isolation: "worktree"` per Agent tool pattern
- Implementers receive the "Specifications to test" list from the plan -- no re-derivation needed
- Spec-reviewer included in verify step (conditional 6th agent)
- Re-run detection: `quality: production` already set + no $ARGUMENTS -> stop
- Checkpoint-based resume: `.claude/current-plan.md` with YAML frontmatter enables exact resume after /clear or context overflow

**Post-merge guidance.** After PR is created, tell the user:

```
Production quality mode is now active.
- All future /change Feature, Fix, and Upgrade changes use TDD automatically.
- On-touch modules will be hardened when you next /change them.
- Run /verify to confirm all tests pass.
```

**POSTCONDITIONS:**
- PR created with verification checklist populated
- `.claude/current-plan.md` deleted
- `.claude/verify-report.md` deleted
- Post-merge guidance displayed to user

**VERIFY:**
```bash
# PR exists for current branch
gh pr view --json url 2>/dev/null && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh harden 9
```

**NEXT:** TERMINAL -- PR created.
