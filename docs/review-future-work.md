# /review Future Work

Improvements identified by 5-agent first-principles analysis (2026-03-08) but deferred from the world-champion PR. Each item is independent and can be implemented as a standalone PR.

## 1. ~~Dimension D: Production Path Consistency~~ — COMPLETED
**Status:** Implemented as validator checks 54-58 (not LLM dimension) — structural invariants are better caught by regex than LLM.

Checks added to `validate-semantics.py`:
- **Check 54:** Procedure files have production branch
- **Check 55:** Production sections reference TDD
- **Check 56:** Production sections reference implementer (feature/upgrade only — fix uses simpler single-task TDD)
- **Check 57:** change.md production block validates `stack.testing`
- **Check 58:** Agent tool declarations match roles (implementer has write tools, spec-reviewer is read-only)

## 2. Validator Self-Tests
**Priority:** HIGH | **Effort:** Medium

The 3 validator scripts ARE /review's quality gate. If a validator has a bug, /review's baseline is wrong. Create:
- `scripts/test_validators.py` — unit tests for validate-frontmatter.py and validate-semantics.py
- `scripts/test_consistency_check.sh` — shell tests for consistency-check.sh
- Run in CI before /review executes

**Why deferred:** Infrastructure change (new test files + CI config), not a review.md edit.

## 3. Pre-Computed Health Card
**Priority:** MEDIUM | **Effort:** Medium | **Estimated token savings:** 30-50% per review

Create `scripts/health-check.py` that quickly scans template health before launching full review:
- Count pending/rejected checks in check-inventory.md
- Scan for TODO strings in skill files
- Count missing references in frontmatter
- Tally fixture coverage gaps
- Return health_score (0-100) + breakdown

Decision logic in review.md Step 2a:
- Score ≥ 90 → "Template is clean — no review needed" → exit
- Score 75-89 → Light review: 1 iteration, max 3 findings per dimension
- Score < 75 → Full review (current behavior)

**Why deferred:** Requires new Python script + review.md conditional branching.

## 4. Parallel Adversaries (one per dimension)
**Priority:** LOW | **Effort:** Low | **Trigger:** Only if dispute rate >30% sustained

Replace single Adversary D with 3 parallel adversaries, each challenging findings from their own dimension. Same turn count (parallel), better precision from domain specialization.

**Why deferred:** Current single adversary works well enough. Only implement if precision data shows systematic judgment failures.

## 5. File Category Auto-Discovery
**Priority:** LOW | **Effort:** Low

Create `scripts/file-inventory.md` listing all template file categories and which review dimensions should read them. When new `.claude/X/` directories are added, they appear in the inventory and review.md adapts.

**Why deferred:** Current manual glob expansion is sufficient for 6 categories. Would matter more at 10+ categories.
