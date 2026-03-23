# STATE 5: COMMIT_PR

**PRECONDITIONS:**
- Final validation passed (STATE 4 POSTCONDITIONS met)
- `.claude/review-complete.json` exists

**ACTIONS:**

If no branch exists (no findings across all iterations):
  Report "Review clean — no findings" and stop.

If branch exists with changes:

- Commit all accumulated changes with a descriptive message
- Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md`:
  - **Summary**: "Automated review-fix: N findings fixed across M iterations"
  - **How to Test**: "Run `make validate` + all 3 validator scripts"
  - **What Changed**: list every file and what changed
  - **Why**: "Template quality — fixes found by 3-dimension LLM review"
- Include in PR body: review summary, fixed findings, skipped/reverted
  findings, new checks added, remaining unfixable findings
- **Disputed findings section**: Under a `### Disputed Findings` heading,
  list all disputed findings across all iterations with adversarial rationale.
  Format as a table: Finding | Dimension | Rationale. Omit section if none.
- **Finding Fate Log section**: Under a `### Finding Fate Log` heading, include
  a table of ALL findings across all iterations:

  | Finding | Dimension | Adversarial Label | Fate | Notes |
  |---------|-----------|------------------|------|-------|

  Fate values: `fixed`, `reverted`, `disputed`, `skipped`.

- **Precision Summary section**: Under a `### Precision Summary` heading, include:
  - Per-dimension precision: (fixed) / (confirmed + needs-evidence) for A, B, C
  - Per-label accuracy: fraction of "confirmed" that were fixed and kept
  - Overall yield: total fixed / total reported across all iterations
- **Close resolved observations**: For each observation issue whose root cause
  was fixed in this review PR, close it with a comment:
  ```bash
  gh issue close <number> --comment "Fixed in review PR #<pr-number>"
  ```

**POSTCONDITIONS:**
- All changes committed
- PR created with full review summary
- Resolved observation issues closed

**VERIFY:**
```bash
git status --porcelain | grep -v '??' | wc -l | xargs test 0 -eq && echo "Clean" || echo "Uncommitted changes"
gh pr list --head "$(git branch --show-current)" --json number,title --limit 1
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh review 5
```

**NEXT:** TERMINAL — review complete.
