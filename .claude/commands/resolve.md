---
description: "Resolve GitHub issues filed against the template: triage, diagnose via first-principles analysis, fix, and validate."
type: code-writing
reads:
  - CLAUDE.md
  - scripts/check-inventory.md
stack_categories: []
requires_approval: true
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
branch_prefix: fix
modifies_specs: false
---
Resolve GitHub issues filed against the template. Three phases with two approval
gates ensure issues are properly triaged, diagnosed with first-principles
reasoning, and fixed with blast radius coverage.

## Phase 1 — Triage

### Step 0: Fetch issues

Determine which issues to resolve:

- If the user specified issue number(s): `gh issue view <N> --json number,title,body,labels,state,comments`
- If the user said "resolve open issues": `gh issue list --state open --limit 20 --json number,title,body,labels`
- If the user said "resolve observations": `gh issue list --label observation --state open --limit 20 --json number,title,body,labels`

Store the fetched issues as `issue_list`.

### Step 1: Read context

- Read `CLAUDE.md`
- Read `scripts/check-inventory.md`
- For each issue in `issue_list`: read every template file mentioned in the issue body

### Step 2: Classify and triage

Classify each issue into one of 9 types:

**Actionable (proceed to Phase 2):**

| Type | Description |
|------|-------------|
| Bug | Template file produces incorrect output or broken code |
| Gap | Missing handling for a valid configuration |
| Inconsistency | Two template files contradict each other |
| Regression | Previously working behavior now broken |
| Observation | Filed by observe.md — template-rooted issue from a project |

**Non-actionable (handle now, skip Phase 2):**

| Type | Action |
|------|--------|
| Environment | Comment: "This is an environment issue, not a template bug. [specific guidance]." Close. |
| User error | Comment: "This appears to be project-specific. [explain why]. Reopen if you believe this is a template issue." Close. |
| Duplicate | Comment: "Duplicate of #N." Close. |
| Won't fix | Comment with rationale. Label `wontfix`. Close. |

For non-actionable issues, execute the close/comment actions now:
```bash
gh issue close <N> --comment "<comment>"
```

Present a triage table:

```
| # | Title | Type | File(s) | Severity | Action |
|---|-------|------|---------|----------|--------|
```

Severity levels: HIGH (breaks execution), MEDIUM (wrong output), LOW (cosmetic).

**STOP. Present the triage table to the user and wait for approval before
proceeding to Phase 2.** The user may reclassify issues or remove them from scope.

## Phase 2 — Diagnose

For each actionable issue (after user approval of triage):

### Step 3: Mental simulation reproduction

Reproduce the issue by tracing through the template as if you were Claude
executing the skill:

1. Read the skill/pattern file cited in the issue
2. Walk through each step, evaluating conditionals against the configuration
   that triggers the bug
3. Identify the exact step and line where behavior diverges from expectation
4. Record: `divergence_point` (file:line), `expected` behavior, `actual` behavior

### Step 4: Blast radius analysis

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

### Step 5: First-principles fix design

Design the fix using world-champion reasoning:

**Root cause decomposition** — answer WHY, not just WHAT:
- What assumption does the template make that is violated?
- When was this assumption introduced? (git blame if helpful)
- Is the assumption wrong, or is the input that violates it unexpected?

**Fix requirements** (all must be satisfied):
1. **Root cause**: Fix addresses the underlying cause, not just the symptom
2. **Blast radius coverage**: All instances from Step 4 are fixed, not just the
   reported one
3. **Regression prevention**: If the pattern can recur, propose a validator check
   (with target script, check name, pass/fail criteria)
4. **Template universality**: Fix works for ALL experiment.yaml configurations
   (all archetypes, with/without optional stacks)
5. **Simplest correct solution**: Minimum change that satisfies requirements 1-4

**Anti-patterns** (reject fixes that fall into these):
- **Band-aid**: Fixes the symptom but not the root cause
- **Over-engineering**: Adds abstraction or framework beyond what the fix needs
- **Narrow fix**: Only fixes the reported instance, ignores blast radius
- **No prevention**: Fixes the bug but adds no guard against recurrence

Record: `root_cause`, `fix_plan` (per-file changes), `proposed_checks` (if any),
`anti_pattern_review` (confirm none apply).

Present a diagnosis report for all actionable issues:

```
## Issue #N: <title>

**Root cause:** <1-2 sentences>
**Divergence point:** <file:line>
**Blast radius:** N files affected (M confirmed, K potential)
**Fix plan:**
- <file>: <what changes>
**Proposed validator check:** <name> in <script> | none
**Anti-pattern review:** None apply / <which one was close and why it doesn't apply>
```

**STOP. Present the diagnosis report to the user and wait for approval before
proceeding to Phase 3.** The user may adjust fix plans or scope.

## Phase 3 — Fix

### Step 6: Branch setup

Follow `.claude/patterns/branch.md` with:
- `branch_prefix`: `fix`
- `branch_name`: `fix/resolve-<N>-<slug>` where N is the primary issue number
  and slug is a 2-3 word description (e.g., `fix/resolve-42-missing-cli-check`)

If resolving multiple issues: use the lowest issue number and a general slug
(e.g., `fix/resolve-42-template-fixes`).

### Step 7: Implement fixes

For each issue in severity order (HIGH first):

1. Implement the fix per the approved fix plan from Step 5
2. If a validator check was proposed: implement it in the target script
3. Run all 3 validators:
   - `python3 scripts/validate-frontmatter.py`
   - `python3 scripts/validate-semantics.py`
   - `bash scripts/consistency-check.sh`
4. If error count increased vs pre-fix count → revert with
   `git checkout -- <modified files>`, log as "reverted", move to next issue
5. If error count same or decreased → keep the fix

If new validator checks were added:
- Update `scripts/check-inventory.md` (add to appropriate table, update counts)

### Step 8: Final validation

- Run all 3 validators
- Record `final_errors`
- If `final_errors` > 0 for checks that passed before Step 7: stop and report regression

### Step 9: Commit, push, open PR

Commit all changes with message: `Fix #N: <imperative description>`
(or `Fix #N, #M: <description>` for multiple issues).

Push and open PR using `.github/PULL_REQUEST_TEMPLATE.md`:

- **Summary**: For each issue resolved:
  - Issue number and title
  - Root cause (1 sentence)
  - What changed
- **How to Test**: "Run `make validate` + all 3 validator scripts"
- **What Changed**: List every file and what changed
- **Why**: "Resolves template issues reported in #N" with `Closes #N` for each issue

Include additional sections in PR body:

### Root Cause Analysis
For each issue: root cause, divergence point, and why the fix addresses it.

### Blast Radius
Files checked, confirmed matches fixed, potential matches evaluated.

### Validator Additions
New checks added (if any), with name, target script, and pass/fail criteria.
If none: "No new checks — pattern is unlikely to recur."

## Do NOT

- Modify experiment.yaml or other spec files
- Add new features or pages
- Fix things not described in the issues
- Install or remove packages
- Commit to main directly
- Skip validator runs after fixes
- Commit fixes that cause validator regressions
- Apply band-aid fixes that don't address root cause
- Fix only the reported instance when blast radius shows more
