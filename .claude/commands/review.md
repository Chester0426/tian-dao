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

## Step 1: Run baseline validators

- Run all 3 validators, capture total error count as `baseline_errors`:
  - `python3 scripts/validate-frontmatter.py`
  - `python3 scripts/validate-semantics.py`
  - `bash scripts/consistency-check.sh`
- If a script fails to run (missing python3/pyyaml): stop and tell the user

## Step 2: Review-Fix Loop

Run **exactly 3 iterations** of the following cycle. The ONLY early exit
is when step 2b produces 0 remaining findings (all 3 subagents found nothing
new). Completing fixes does NOT justify exiting early — fixes may introduce
new issues that only a fresh scan can detect.

Initialize before the first iteration:
- `seen_findings` = empty set
- `iteration` = 1

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

After reading: mentally simulate running `/bootstrap` and `/change` with each fixture's configuration.

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
- Read `Makefile`

After reading: trace the user journey for each archetype:
- web-app: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` → `/change` → `/verify` → `/distribute` → `/iterate` → `/retro` → `/teardown`
- service: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` → `/change` → `/verify` → `/distribute` (if surface ≠ none) → `/iterate` → `/retro` → `/teardown`
- cli: `make validate` → `/bootstrap` → merge → `/verify` → `/deploy` (surface only) → `npm publish` → `/change` → `/verify` → `/distribute` (if surface ≠ none) → `/iterate` → `/retro`

**Finding Format**

Each subagent must use this format for findings:

```
### Finding N: <title>
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

1. **Maximum 5 findings.** Keep only the 5 most impactful.
2. **No overlap with automated checks.** `scripts/check-inventory.md` is authoritative, including the Pending and Rejected sections. If a check is pending, propose extending it instead. If a check was rejected, do not re-propose it unless the rejection reason no longer applies.
3. **Zero findings is valid.** Say "No findings for this dimension" and summarize what was checked.
4. **Self-review before presenting.** Merge proposed checks that cover the same invariant. Verify each finding against check-inventory.md one more time.
5. **Concrete fixes only.** Every fix must be implementable in a single PR.

**Observation backlog** (if `observation_backlog` is non-empty):
Include the observation issue titles and root cause descriptions as additional
review context for all three dimension agents. Each agent should check whether
any of their findings overlap with an open observation. If a dimension agent's
fix addresses an observation issue's root cause, note the issue number.

On iteration 2+: include the list of seen finding signatures in the subagent prompt so they skip already-reported issues.

After all 3 return: collect up to 15 findings, deduplicate.

#### 2b: Filter findings

- A finding signature = `<file_path>:<finding_title>`
- Remove findings whose signatures match `seen_findings` set (oscillation guard)
- If 0 remaining findings → **exit loop**, proceed to Step 3
- Add new signatures to `seen_findings`

#### 2c: Branch setup (first iteration only)

Follow `.claude/patterns/branch.md` with prefix `chore` and name `chore/review-fixes`.

If branch already exists from prior iteration, continue on it.

#### 2d: Fix findings

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

If no fixes succeeded this iteration → **exit loop**, proceed to Step 3.

#### 2e: Compact state and loop gate

Emit a compact state summary and discard prior detail:

```
## Iteration N complete
- seen_findings: [list of all finding signatures across all iterations]
- error_count: [current validator error count]
- files_modified: [list of files changed so far]
- fixes_applied: N, reverted: M, skipped: K
- checks_added: [list of new validator checks, or "none"]
```

This summary is the only carry-forward state needed. Prior subagent results,
file reads, and validator outputs from this iteration are no longer needed and
can be safely compressed.

**MANDATORY LOOP GATE — answer before proceeding:**

> Is `iteration` ≥ 3?
> - **YES** → proceed to Step 3.
> - **NO** → increment `iteration`, **go to 2a NOW**. Do NOT proceed to Step 3.
>
> You MUST re-scan with fresh subagents. Fixes from this iteration may have
> introduced new issues, and reviewers may find things they missed when the
> old text was still present. Proceeding to Step 3 early wastes review coverage.

## Step 3: Update check-inventory.md

If new validator checks were implemented in Step 2d:

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
- Run more than 3 iterations
- Skip running validators after each fix
- Commit fixes that cause validator regressions
- Install or remove packages
- Commit to main directly
