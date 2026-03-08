---
description: "Automated review-fix loop: find issues, fix them, validate, repeat until clean."
type: code-writing
reads:
  - CLAUDE.md
  - EVENTS.yaml
  - scripts/check-inventory.md
  - idea/idea.example.yaml
stack_categories: []
requires_approval: false
references:
  - .claude/patterns/verify.md
  - .claude/patterns/branch.md
  - .claude/patterns/observe.md
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
- **Check open observation issues** (if `template_repo` is set in idea.yaml):
  ```bash
  gh issue list --repo <template_repo> --label observation --state open --limit 10 --json number,title,body
  ```
  If any open issues exist, save them as `observation_backlog`. These will be
  used as additional input in Step 2a below. If none exist or the command fails,
  set `observation_backlog` to empty and continue.
- **Read prior review precision** (if `template_repo` is set):
  ```bash
  gh pr list --repo <template_repo> --state merged --search "Automated review-fix" --limit 1 --json number,body
  ```
  If found, extract the Precision Summary. Store as `prior_precision`.
  Use prior precision to coach each dimension's agent in Step 2a:
  - If `disputed_rate` > 30%: add to prompt: "Prior review had high dispute rate — only report findings where the contradiction cannot be resolved by reading surrounding context."
  - If `skipped_rate` > 20%: add to prompt: "Prior review had many unfixable findings — focus on findings directly fixable in a single PR."
  - If `reverted_rate` > 20%: add to prompt: "Prior review had fixes that caused regressions — be conservative with fixes that touch cross-file invariants."
  - If overall dimension precision < 50%: also reduce to top 3 findings instead of 5.
  If not found or command fails, set `prior_precision` to empty and continue.

## Step 1: Run baseline validators

- Run all 3 validators, capture total error count as `baseline_errors`:
  - `python3 scripts/validate-frontmatter.py`
  - `python3 scripts/validate-semantics.py`
  - `bash scripts/consistency-check.sh`
- If a script fails to run (missing python3/pyyaml): stop and tell the user

- **Compute `health_clean`** (boolean):
  - `baseline_errors == 0` (all validators pass)
  - AND no rows under `## Pending` in `scripts/check-inventory.md` (grep for non-empty rows after that heading)
  - AND no `TODO` strings in `.claude/commands/*.md` or `.claude/stacks/**/*.md`

  If `health_clean == true`:
  - Set `max_iterations = 3`, `max_findings_per_dimension = 3`
  - Log: "Template health: clean — using light review parameters (3 iterations, 3 findings/dimension)"

  If `health_clean == false`:
  - Set `max_iterations = 5`, `max_findings_per_dimension = 5`
  - Log: "Template health: needs attention — using full review parameters"

## Step 2: Review-Fix Loop

Run **2 to `max_iterations`** iterations of the following cycle, terminating based on
convergence (see Loop Gate in 2f). Within-iteration early exits:
- Step 2b produces 0 remaining findings → exit loop
- Step 2e: no fixes succeeded this iteration → exit loop

Completing fixes does NOT justify exiting early — fixes may introduce
new issues that only a fresh scan can detect.

Initialize before the first iteration:
- `seen_findings` = empty set
- `iteration` = 1
- `yield_history` = empty list

---

### Each iteration:

#### 2a: Review

Launch 3 Explore subagents in parallel, one per dimension below. Construct each
agent's prompt from:

- The **shared context instruction** (box below)
- The agent's **dimension section** (focus, examples, files to read)
- The **Finding Format**, **Check Proposal Criteria**, and **Rules** sections

> **Shared context instruction** — include verbatim in every subagent prompt:
>
> Before reviewing, read these files:
> Glob `.claude/archetypes/*.md`, `scripts/check-inventory.md`, `CLAUDE.md`, `idea/idea.example.yaml`, `EVENTS.yaml`.
> Do not report anything already covered by check-inventory.md (including Pending).

**Dimension A: Cross-File Consistency**

Focus: Find contradictions or inconsistencies **between** files that no regex or structural check can catch. Examples:
- A skill file says "do X" but a stack file's code template does Y
- A rule in CLAUDE.md conflicts with how a skill actually operates
- A stack file assumes a convention that another stack file violates
- A prose instruction references a function/file/path that doesn't match reality

Files to read:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file
- Glob `.claude/patterns/*.md` — read each pattern file
- Glob `.claude/procedures/*.md` — read each procedure file
- Glob `.claude/agents/*.md` — read each agent definition

After reading: for each potential finding, identify which archetype and stack
configuration triggers the contradiction. Record the config alongside the finding.

**Dimension B: Edge Case Robustness**

Focus: Find configurations where skills or stack files would produce broken output. Examples:
- A skill assumes auth exists but the idea.yaml has no `stack.auth`
- A code template hard-codes a path that changes based on stack choices
- A conditional branch in a skill handles 2 of 3 possible states
- A skill's conditional branching handles 2 of 3 archetypes (e.g., web-app and service but not cli)
- An edge case not covered by the test fixtures

Files to read:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file
- Glob `tests/fixtures/*.yaml` — read each test fixture
- Glob `.claude/procedures/*.md` — read each procedure file
- Glob `.claude/agents/*.md` — read each agent definition

After reading: for each potential finding, identify the test fixture(s) whose
`idea.stack` configuration matches the edge case (e.g., a finding about missing
`stack.auth` → use fixtures that lack auth). Record the fixture name(s) alongside
the finding. If no fixture covers the edge case, note "no fixture coverage" —
this itself may be a finding worth reporting.

**Dimension C: User Journey Completeness**

Focus: Find dead-end states where a user gets stuck with no clear next step. Examples:
- A skill exits early but doesn't tell the user what to do next
- A build failure produces an unhelpful error message
- A workflow step assumes a previous step succeeded but doesn't verify
- A Makefile target fails silently or with an unhelpful error
- The user follows instructions but ends up in an undocumented state

Files to read:
- Glob `.claude/commands/*.md` — read each skill file
- Glob `.claude/stacks/**/*.md` — read each stack file
- Glob `.claude/patterns/*.md` — read each pattern file
- Glob `.claude/procedures/*.md` — read each procedure file
- Glob `.claude/agents/*.md` — read each agent definition
- Read `Makefile`

After reading: trace the user journey for each archetype:
- web-app: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` → `/change` → `/verify` → `/distribute` → `/iterate` → `/retro` → `/teardown`
- service: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` → `/change` → `/verify` → `/distribute` (if surface ≠ none) → `/iterate` → `/retro` → `/teardown`
- cli: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` (surface only) → `npm publish` → `/change` → `/verify` → `/distribute` (if surface ≠ none) → `/iterate` → `/retro`

For each finding, record the archetype and fixture(s) whose config matches the
dead-end scenario. If no fixture covers it, note "no fixture coverage."

**Finding Format**

Each subagent must use this format for findings:

```
### Finding N: <title>
- **Severity**: HIGH (breaks execution) | MEDIUM (wrong output, confusing) | LOW (cosmetic, minor inconsistency)
- **File(s)**: ...
- **Issue**: ... (be specific — quote the conflicting text)
- **Impact**: ... (what breaks or confuses the user)
- **Fix**: ... (concrete, implementable)
- **Proposed check** (only if the finding qualifies — see Check Proposal Criteria):
  - **Target**: validate-frontmatter.py | validate-semantics.py | consistency-check.sh
  - **Name**: imperative verb phrase (e.g., "Verify X matches Y")
  - **Category**: structural | cross-file sync | behavioral contract | reference check
  - **Similar to**: existing/pending check from check-inventory.md, or "none"
  - **Pass/fail**: one sentence describing what constitutes failure
```

**Check Proposal Criteria**

A proposed check must fall into one of these categories:

| Category | What it catches | Example |
|----------|----------------|---------|
| Structural | Missing keys, malformed data, invalid syntax | "Fixture YAML missing required `assertions` key" |
| Cross-file sync | Value in file A doesn't match corresponding value in file B | "Env var in prose not declared in frontmatter" |
| Behavioral contract | Code template would produce broken output at runtime | "Non-src template uses `process.env` without loading env config" |
| Reference check | A named reference (tool, file, path) doesn't resolve | "Skill references unknown tool `FooBar`" |

Do NOT propose checks that:
- Regex-match natural-language prose for specific wording (e.g., "prose must contain the word 'branch' within 200 chars of a recovery message")
- Enforce cosmetic formatting with no silent-failure risk (e.g., "numbered lists must have no gaps")
- Verify that prose *explains* something (e.g., "skill must document resumption behavior") — this is the scoped LLM review's job

**Rules**

Include these in each subagent prompt:

1. **Maximum `max_findings_per_dimension` findings.** Keep only the most impactful.
2. **No overlap with automated checks.** `scripts/check-inventory.md` is authoritative, including the Pending and Rejected sections. If a check is pending, propose extending it instead. If a check was rejected, do not re-propose it unless the rejection reason no longer applies.
3. **Zero findings is valid.** Say "No findings for this dimension" and summarize what was checked.
4. **Self-review before presenting.** Merge proposed checks that cover the same invariant. Verify each finding against check-inventory.md one more time.
5. **Concrete fixes only.** Every fix must be implementable in a single PR.
6. **Self-filter by confidence.** For each candidate finding, estimate confidence: HIGH (can quote contradicting lines with file:line), MEDIUM (likely issue but needs adversarial check), LOW (suspicious pattern only). Include HIGH and MEDIUM findings. Drop LOW findings.

After all 3 return: collect up to 15 findings, deduplicate.

#### 2b: Filter findings

- A finding signature = `<file_path>:<finding_title>`
- Remove findings whose signatures match `seen_findings` set (oscillation guard)
- If 0 remaining findings → **exit loop**, proceed to Step 3
- Add new signatures to `seen_findings`

#### 2c: Adversarial Validation

Launch a single serial Explore subagent ("Adversarial Agent D") to challenge
each filtered finding before committing to fixes. Include in the agent prompt:

- All filtered findings from step 2b (full Finding Format)
- The `observation_backlog` from Step 0 (if non-empty)
- Instructions — **Counterexample Construction**:

  For each finding, attempt to **construct a proof that the finding is false**.
  The default label is "confirmed" — you must produce positive evidence to dispute.

  **Dimension A (cross-file) findings:**
  1. Read both cited files
  2. Quote the exact lines alleged to contradict (with line numbers)
  3. Check: do these lines apply in the same context? (e.g., one may be inside
     a conditional that excludes the other's scenario)
  4. If no real contradiction when context is considered → "disputed"

  **Dimension B (edge case) findings:**
  1. Identify which fixture(s) match the claimed configuration (use fixture names
     from the dimension agent's report)
  2. Read the fixture's `assertions` section — does it expect this behavior?
  3. Read the specific conditional branch in the cited skill/stack file
  4. If the conditional already handles the case → "disputed", quoting the code
  5. If no fixture covers this config → note "no fixture coverage" (stays "confirmed")

  **Dimension C (user journey) findings:**
  1. Trace the specific journey step claimed to be a dead-end
  2. Read the skill file at the cited step
  3. Check: is there a recovery path, error message, or next-step instruction
     the dimension agent missed?
  4. If a recovery path exists → "disputed", quoting the path

  **Auto-confirm rule** (unchanged): finding matching an open observation's
  root cause → "confirmed" without counterexample construction.

Output format — one entry per finding:
```
### Finding N: <title>
- **Label**: confirmed | disputed | needs-evidence
- **Counterexample**: <what you tried to prove and whether it succeeded>
- **Evidence**: <exact quotes with file:line references>
- **Observation match**: #<number> | none
```

After the agent returns, partition findings:
- **confirmed**: full priority in fix phase
- **needs-evidence**: lower priority (sorted after confirmed in fix queue)
- **disputed**: removed from fix queue; record finding signature + one-line rationale for the PR body
- If 0 findings remain after removing disputed → continue to 2d (the existing 2b exit handles the zero-findings case)

#### 2d: Branch setup (first iteration only)

Follow `.claude/patterns/branch.md` with prefix `chore` and name `chore/review-fixes`.

If branch already exists from prior iteration, continue on it.

#### 2e: Fix findings

For each finding in priority order: HIGH-severity confirmed, then MEDIUM confirmed, then LOW confirmed, then needs-evidence (by severity descending):

1. Implement the fix
2. If finding has a Proposed Check → implement it in the target validator
3. Run all 3 validators
4. If error count increased vs pre-fix count → revert with
   `git checkout -- <modified files>`, log as "reverted", move to next
5. If error count same or decreased → keep the fix
   (do NOT commit per-fix; accumulate changes for a single commit)
6. Record the finding's fate: `fixed`, `reverted`, or `skipped` (if not attempted).
   Carry fates forward in the compact state.

The validator scripts serve as this skill's quality gate, analogous to the
build verification in `.claude/patterns/verify.md`.

If no fixes succeeded this iteration → **exit loop**, proceed to Step 3.

#### 2f: Compact state and loop gate

Emit a compact state summary and discard prior detail:

```
## Iteration N complete
- seen_findings: [list of all finding signatures across all iterations]
- error_count: [current validator error count]
- files_modified: [list of files changed so far]
- fixes_applied: N, reverted: M, skipped: K
- checks_added: [list of new validator checks, or "none"]
- adversarial_validation: confirmed: N, disputed: M, needs-evidence: K
- disputed_findings: [list of disputed finding signatures + one-line rationale]
- finding_fates: [{signature, dimension, adversarial_label, fate}]
- yield_rate: <fixed_count / (confirmed + needs-evidence count)>
- yield_by_dimension: { A: <fixed/actionable>, B: <fixed/actionable>, C: <fixed/actionable> }
- error_delta: <current error_count - prior iteration error_count>
```

This summary is the only carry-forward state needed. Prior subagent results,
file reads, and validator outputs from this iteration are no longer needed and
can be safely compressed.

**MANDATORY LOOP GATE — evaluate before proceeding:**

Compute this iteration's yield rate:
- `yield` = (findings fixed this iteration) / (confirmed + needs-evidence this iteration)
- Disputed findings are excluded from the denominator — they are adversarial successes, not signal failures
- If denominator is 0, yield = 0
- Append yield to `yield_history`

Termination decision (evaluate in order — first match wins):

1. **Minimum floor**: `iteration` < 2 → increment `iteration`, go to 2a NOW.
   (A single scan is never sufficient — fixes may introduce new issues.)
   Exception: if `iteration` == 1 AND 0 findings were reported → proceed to Step 3.
   (Template is clean; a second empty scan adds no value.)

2. **Zero yield**: yield = 0 and no findings were fixed → proceed to Step 3.

3. **Regression trend**: `iteration` ≥ 2 and `error_delta` > 0 for 2 consecutive
   iterations → proceed to Step 3.
   (Error count rising across iterations signals cascading fix regressions.)

4. **Diminishing returns**: `iteration` ≥ 3 and yield < 0.25 → proceed to Step 3.
   (Fewer than 1 in 4 reported findings actually got fixed — mostly noise.)

5. **Hard cap**: `iteration` ≥ `max_iterations` → proceed to Step 3.

6. **Continue**: increment `iteration`, **go to 2a NOW**. Fixes from this
   iteration may have introduced new issues.

State which condition triggered your decision before proceeding.

## Step 3: Update check-inventory.md

If new validator checks were implemented in Step 2e:

- Add each to the appropriate table in `scripts/check-inventory.md`
- Update the total counts in the header
- Clear any matching entries from the Pending table

## Step 4: Final validation

- Run all 3 validators
- Record `final_errors`
- If `final_errors` > `baseline_errors` → stop and report regression

## Step 5: Commit, push, open PR

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
  gh issue close <number> --repo <template_repo> --comment "Fixed in review PR #<pr-number>"
  ```

## Do NOT

- Modify idea.yaml or EVENTS.yaml
- Enter plan mode or wait for user approval
- Add new features or pages
- Propose checks that regex-match natural-language prose
- Fix findings that overlap with check-inventory.md
- Run more than `max_iterations` iterations
- Exit before completing iteration 2 (minimum 2 required)
- Skip running validators after each fix
- Commit fixes that cause validator regressions
- Install or remove packages
- Commit to main directly
