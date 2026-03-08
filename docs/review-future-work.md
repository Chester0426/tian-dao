# /review Future Work

Improvements identified by 5-agent first-principles analysis (2026-03-08) but deferred from the world-champion PR. Each item is independent and can be implemented as a standalone PR.

## 1. Dimension D: Production Path Consistency
**Priority:** HIGH | **Effort:** Medium | **Trigger:** After quality:production sees real usage

Add a 4th review dimension focused on detecting drift between MVP and production execution paths in /change. The two paths (quality absent vs quality: production) are tightly coupled but reviewed independently. Dimension D would:
- Read change.md MVP + production branches
- Read procedure files (change-feature.md, change-upgrade.md, change-fix.md)
- Read agent definitions (implementer.md, spec-reviewer.md)
- Find: preconditions present in MVP but missing in production (or vice versa), agent spawn parameters inconsistent with skill expectations, TDD path missing coverage for a change type

**Why deferred:** Would push review.md past 450 lines. Better as a separate procedure file (`.claude/procedures/review-dimension-d.md`) referenced by review.md — follows the same decomposition pattern used for /change.

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
