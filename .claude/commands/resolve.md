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
  - .claude/patterns/solve-reasoning.md
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

Classify each issue into one of 10 types:

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
| Stale | The described problem no longer exists in current code. Verify with a lightweight check: (1) `git log --oneline --since="<issue_created_date>" -- <cited_file>` — if the file was modified since the issue was filed, (2) read the cited file and confirm the specific pattern/text described in the issue is gone or fixed. Only classify as Stale when evidence is clear; ambiguous cases should proceed to Phase 2. Comment: "Verified against current main — this was fixed in [commit/PR]. [brief explanation]." Close. |
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
5. **Validator evidence** (machine-verifiable baseline):
   Run all 3 validators and capture output as `pre_fix_baseline`:
   - `python3 scripts/validate-frontmatter.py 2>&1`
   - `python3 scripts/validate-semantics.py 2>&1`
   - `bash scripts/consistency-check.sh 2>&1`

   Search validator output for errors citing the issue's file(s).
   If a validator error corresponds to the divergence_point:
   `reproduction = "validator-confirmed"` + the error line(s).
   Otherwise: `reproduction = "simulation-only"` (acceptable for
   prose/logic bugs that validators cannot catch).

**Cannot reproduce:** If the simulation completes without finding a divergence
point, the issue may have been fixed indirectly (e.g., by a refactor or a
related fix that also covered this case). Downgrade the issue to non-actionable:
comment with "Unable to reproduce against current main — the described behavior
no longer occurs. [explain what was checked]. Reopen if the issue persists."
Close the issue and remove it from the actionable list. Continue with remaining
issues.

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

### Step 4b: Root-cause clustering (2+ issues only)

Skip if only 1 actionable issue remains.

Compare divergence points and causal patterns across all actionable issues:

1. Group issues sharing the same root pattern (e.g., 3 issues all
   caused by "missing archetype guard" = 1 cluster)
2. For each cluster of 2+ issues:
   - Designate the highest-severity issue as **primary**
   - Mark others as **correlated**: "shares root cause with #N"
   - Design ONE unified fix in Step 5 (not N separate fixes)
3. Uncorrelated issues get individual fix designs as before

Present in diagnosis report:
```
### Root-Cause Clusters
- Cluster 1 (#A, #B): <shared pattern>. Primary: #A.
- Uncorrelated: #C
```

### Step 5: First-principles fix design (solve-reasoning)

#### 5a) Complexity assessment

Determine solve-reasoning depth:

```
solve_depth = "light"  # default
if blast_radius confirmed >= 3: solve_depth = "full"
if severity = HIGH: solve_depth = "full"
```

State the depth selection with rationale before proceeding.

#### 5b-light) Light mode path

When `solve_depth = "light"`: call `.claude/patterns/solve-reasoning.md` light mode (Steps 1-5).

- **Inputs**: `divergence_point`, `blast_radius`, `reproduction`, `severity` as constraints
- **Output mapping**:
  - "Recommended Solution" -> `root_cause`
  - "Implementation Steps" -> `fix_plan`
  - "Constraints Respected" -> `anti_pattern_review`
  - "Key Tradeoff" -> diagnosis report

#### 5b-full) Full mode path

When `solve_depth = "full"`: call `.claude/patterns/solve-reasoning.md` full mode (Phases 1-6).

- **Phase 1 agent customization**:
  - Agent 1 = divergence investigation (trace the assumption violation, git blame context)
  - Agent 2 = blast radius + prior fix art (grep for the causal pattern broadly, find past fixes for similar patterns)
  - Agent 3 = fix constraints (validator compatibility, archetype universality, backwards compatibility)
- **Phase 3 questions**: HELD — merged into the diagnosis STOP gate (see Step 5 STOP augmentation below)
- **Phase 5 Critic**: receives domain-specific vectors (see Step 5c below)
- **Output mapping**:
  - "Recommended Solution" -> `root_cause` + `fix_plan`
  - "Constraint Space" -> hard constraints in diagnosis report
  - "Remaining Risks" TYPE B -> system constraints in diagnosis report
  - "Remaining Risks" TYPE C -> merged into STOP gate questions
  - "Remaining Risks" Caveats -> caveats in diagnosis report

#### 5c) Domain-specific post-validation

After solve-reasoning completes (either mode), apply template-specific validation:

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

If validation rejects the solution:
- **Light mode**: iterate once through solve-reasoning Step 4 (Self-Check)
- **Full mode**: iterate once through Phase 5 critic round 2

Record: `root_cause`, `fix_plan` (per-file changes), `proposed_checks` (if any),
`anti_pattern_review` (confirm none apply).

### Step 5d: Adversarial challenge

The adversarial challenge adapts based on `solve_depth`:

#### Light mode adversarial challenge

Launch a single Explore subagent to challenge each fix design:

Prompt includes: all fix plans from Step 5 (root cause, fix plan,
blast radius, anti-pattern review).

**Fix Challenge Protocol** — for each fix, attempt to construct a
scenario where the fix is wrong or insufficient. Default label is
"sound"; challenger must produce evidence to dispute.

Three challenge vectors:

1. **Configuration counterexample**: Find an experiment.yaml
   configuration (archetype + stack) where the fix would break.
   Read fixtures in `tests/fixtures/*.yaml` for concrete configs.

2. **Blast radius gap**: Are there files NOT in the blast radius
   that share the pattern? Grep more broadly than Step 4.

3. **Regression vector**: Would this fix break existing validator
   checks? Read `scripts/check-inventory.md` and identify checks
   touching the same files.

Output per fix:
```
### Fix for Issue #N
- **Label**: sound | challenged | needs-revision
- **Challenge**: <what was tried>
- **Evidence**: <file:line quotes or fixture names>
- **Revision**: <if not sound: specific change to fix plan>
```

After the agent returns:
- **sound**: proceed as designed
- **needs-revision**: incorporate revision, note in diagnosis report
- **challenged**: present to user at STOP gate; let user decide

#### Full mode adversarial challenge

Step 5d is replaced by solve-reasoning Phase 5 Critic Loop (already
executed in Step 5b-full). The 3 domain-specific challenge vectors
above (configuration counterexample, blast radius gap, regression
vector) are injected into the Critic prompt as additional instructions.

Critic output mapping:
- **TYPE A round 1** -> revision to `fix_plan` (already applied)
- **TYPE A round 2** (unresolved) -> caveats in diagnosis report
- **TYPE B** -> system constraints in diagnosis report
- **TYPE C** -> merged into STOP gate questions (see below)

Present a diagnosis report for all actionable issues:

```
## Issue #N: <title>

**Root cause:** <1-2 sentences>
**Divergence point:** <file:line>
**Reproduction:** validator-confirmed (<error>) | simulation-only
**Blast radius:** N files affected (M confirmed, K potential)
**Fix plan:**
- <file>: <what changes>
**Proposed validator check:** <name> in <script> | none
**Anti-pattern review:** None apply / <which one was close and why it doesn't apply>
**Adversarial check:** sound | revised (<what changed>) | challenged (<summary>)
```

**Full mode STOP augmentation**: If `solve_depth = "full"` for any issue, append
to the diagnosis report before presenting:

```
### Deep Analysis Questions
[Phase 3 User Injection questions — 3-5 specific questions from research gaps]
[Phase 5 TYPE C concerns — assumptions only the user can validate]

### System Constraints
[Phase 5 TYPE B items — immutable constraints the fix must work around, or "None"]
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
2b. If the bug involves a configuration not covered by existing test
    fixtures (identified in Step 5b or by checking `tests/fixtures/`):
    create a minimal fixture following existing naming conventions.
    Include only the stack/archetype config needed to trigger the bug
    pattern, with assertions that catch it. Skip if triggering config
    is already covered.
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

### Step 8b: Side-effect scan

For issues closed as "cannot reproduce" in Step 3 or non-actionable
in Step 2: if any file modified in Steps 7-8 is cited in the issue,
comment: "This may have been addressed by the fix in PR #<number>
(for #<primary>). Verify and reopen if the issue persists."

For other open issues not in the current batch:
```bash
gh issue list --state open --limit 10 --json number,title,body
```
If any reference files modified in this PR: note under a
"### Potentially Resolved" section in the PR body (do NOT close —
the fix was not designed for them).

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

### Validator Evidence
| Issue | Pre-Fix Errors | Post-Fix Errors | Delta |
|-------|---------------|-----------------|-------|
| #N    | <cited errors or "none"> | <errors or "none"> | -K |

### Adversarial Review
| Issue | Label | Challenge Summary |
|-------|-------|-------------------|
| #N    | sound | Tested 3 fixture configs, no breakage |

### Cross-Issue Correlation
- Cluster 1: #A, #B — shared root cause: <pattern>. Single fix.
- Uncorrelated: #C
(Or: "Single issue — no correlation analysis")

### Potentially Resolved
(From Step 8b, or "None — no side-effect matches detected")

### Step 10: Save resolution patterns

For each resolved issue, evaluate:

1. **Resolution pattern** (accelerates future diagnosis):
   Save to auto memory under "Resolution Patterns" heading:
   - Issue type + root cause pattern (1 line)
   - What to check first when this pattern recurs (1 line)
   - Example: "Missing archetype guard → grep for archetype-conditional
     language in cited file, check all 3 archetypes have branches"

2. **Universal template pitfall** (prevents recurrence across projects):
   Note in auto memory: "Consider adding Known Pitfall to <file>."
   Do NOT edit stack/pattern files inline — that's scope creep.

Skip if: trivial fix (typo) unlikely to recur.

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
