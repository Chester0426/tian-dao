---
description: "Automated review-fix loop: find issues, fix them, validate, repeat until clean."
type: code-writing
reads:
  - CLAUDE.md
  - EVENTS.yaml
stack_categories: []
requires_approval: false
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
branch_prefix: chore
modifies_specs: false
---
Run an automated review of the experiment template, fix findings, and validate
until clean. Replaces the manual workflow of running `scripts/scoped-review-prompt.md`.

## Step 0: Read context

- Read `CLAUDE.md`
- Read `EVENTS.yaml`
- Read `scripts/check-inventory.md`
- Read `idea/idea.example.yaml` (for understanding template structure)

## Step 1: Run baseline validators

- Run all 3 validators, capture total error count as `baseline_errors`:
  - `python3 scripts/validate-frontmatter.py`
  - `python3 scripts/validate-semantics.py`
  - `bash scripts/consistency-check.sh`
- If a script fails to run (missing python3/pyyaml): stop and tell the user

## Step 2: Review (iteration N)

Launch 3 Explore subagents in parallel (same dimensions as
`scripts/scoped-review-prompt.md`):

- **A: Cross-File Consistency** — skills + stacks
- **B: Edge Case Robustness** — skills + stacks + test fixtures
- **C: User Journey Completeness** — skills + stacks + Makefile + `.claude/patterns/verify.md`

Each subagent gets:
- Shared context instruction (read `scripts/check-inventory.md`, `CLAUDE.md`,
  `idea/idea.example.yaml`, `EVENTS.yaml`)
- Dimension focus, file list, examples
- Finding format (File(s), Issue, Impact, Fix, optional Proposed Check)
- Rules (max 5 per dimension, no check-inventory overlap, zero is valid)
- On iteration 2+: list of seen finding signatures to skip

After all 3 return: collect up to 15 findings, deduplicate.

## Step 3: Filter findings

- A finding signature = `<file_path>:<finding_title>`
- Remove findings whose signatures match `seen_findings` set (oscillation guard)
- If 0 remaining findings → skip to Step 8
- Add new signatures to `seen_findings`

## Step 4: Branch setup (first iteration with findings only)

Follow `.claude/patterns/branch.md` with prefix `chore` and name `chore/review-fixes`.

If branch already exists from prior iteration, continue on it.

## Step 5: Fix findings

For each finding in priority order:

1. Implement the fix
2. If finding has a Proposed Check → implement it in the target validator
3. Run all 3 validators
4. If error count increased vs pre-fix count → revert with
   `git checkout -- <modified files>`, log as "reverted", move to next
5. If error count same or decreased → keep the fix
   (do NOT commit per-fix; accumulate changes for a single commit)

The validator scripts serve as this skill's quality gate, analogous to the
build verification in `.claude/patterns/verify.md`.

## Step 6: Check iteration limit

- Increment iteration counter
- If iteration < 3 AND at least one fix succeeded → return to Step 2
- Otherwise → proceed to Step 7

## Step 7: Update check-inventory.md

If new validator checks were implemented in Step 5:

- Add each to the appropriate table in `scripts/check-inventory.md`
- Update the total counts in the header
- Clear any matching entries from the Pending table

## Step 8: Final validation

- Run all 3 validators
- Record `final_errors`
- If `final_errors` > `baseline_errors` → stop and report regression

## Step 9: Commit, push, open PR

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

## Do NOT

- Modify idea.yaml or EVENTS.yaml
- Enter plan mode or wait for user approval
- Add new features or pages
- Propose checks that regex-match natural-language prose
- Fix findings that overlap with check-inventory.md
- Run more than 3 iterations
- Skip running validators after each fix
- Commit fixes that cause validator regressions
- Install or remove packages
- Commit to main directly
