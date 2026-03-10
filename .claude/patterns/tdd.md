# Test-Driven Development Procedure

Follow this procedure when implementing features, fixes, or hardening under `quality: production` mode.

> **Scope:** This pattern is consumed by the implementer agent (`agents/implementer.md`)
> when `quality: production` is set in experiment.yaml. It is not used in MVP mode.

## Red-Green-Refactor Cycle

For every task:

1. **RED** — Write a failing specification test that defines what the code SHOULD do.
   Run the test. Confirm it fails with the expected error.
2. **GREEN** — Write the minimal code to make the test pass. No more, no less.
3. **REFACTOR** — Improve the code under green tests. Rename, extract, simplify.
   Run the test after each change to confirm it still passes.
4. **COMMIT** — Commit with a descriptive message referencing the feature or fix.

Never skip the RED phase. If the test passes immediately, the code already
satisfies the specification — skip to REFACTOR and move on.

## Specification Tests

Specification tests are the primary approach in production mode. They define
what the code SHOULD do, not what it currently DOES.

- Derive test cases from experiment.yaml `behaviors`, `golden_path`, and behaviors with `actor: system/cron`
- Each test asserts correct behavior for a specific input/scenario
- If code fails a specification test, that is a real bug — fix the code
- Do NOT write characterization tests (tests that merely snapshot current behavior)

Example:

```typescript
// Specification test: defines CORRECT behavior
expect(validateEmail("bad@@email")).toBe(false);
expect(validateEmail("user@example.com")).toBe(true);

// NOT a characterization test like:
// expect(validateEmail("bad@@email")).toBe(getCurrentResult("bad@@email"));
```

## Regression Tests

Use regression tests for bug fixes. They are distinct from specification tests.

1. Write a test that demonstrates the bug (fails on the current code)
2. Fix the code
3. Confirm the test passes

The test documents the specific failure case so it cannot recur. Label regression
tests clearly (e.g., `it("should not crash when input is empty — regression #42")`).

## Task Granularity

Each TDD task must be small and self-contained:

- **Duration:** 2-5 minutes of work
- **Scope:** One concern per task (do not mix auth + payment in one task)
- **Precision:** Exact file paths to create or modify
- **Clarity:** Expected test code, expected failure message, minimal implementation

Bad task: "Add user authentication"
Good task: "Add `validatePassword` in `src/lib/auth.ts` — spec test: rejects
passwords shorter than 8 characters, accepts valid passwords. Expected failure:
`validatePassword is not a function`."

## Task Dependency Ordering

Before spawning implementer agents, analyze the dependency graph:

1. List all tasks and their file inputs/outputs
2. Identify dependencies: Task B imports from Task A's output
3. Group tasks:
   - **Independent tasks** (no shared dependencies) — run in parallel
   - **Dependent tasks** (B requires A's output) — run sequentially (A before B)
4. Document: "N tasks total, M parallel / K sequential"

Example:
```
Task 1: Create src/lib/validators.ts (no deps)        — parallel group A
Task 2: Create src/lib/auth.ts (no deps)               — parallel group A
Task 3: Create src/app/api/signup/route.ts (imports 1+2) — sequential after A
→ 3 tasks total, 2 parallel / 1 sequential
```

## Test Type Selection

| Scenario | Test Type | Workflow |
|----------|-----------|----------|
| New feature | Specification (TDD) | RED — GREEN — REFACTOR |
| Hardening existing module | Specification | Write spec test — may fail — fix code |
| Bug fix | Regression | Write test demonstrating bug — fix — pass |
| Refactoring | Existing tests | Refactor under green tests only |

- **New feature:** No code exists yet. Write the spec test first, then the code.
- **Hardening:** Code exists but lacks tests. Write spec tests for what it SHOULD do.
  If the test fails, the code has a bug — fix it.
- **Bug fix:** A specific failure is known. Write a regression test, then fix.
- **Refactoring:** Tests already pass. Change structure without changing behavior.

## What NOT to Test

Skip tests for:

- UI rendering and layout (visual review covers this)
- Static content (copy, labels, placeholder text)
- Framework boilerplate (routing config, middleware wiring, provider setup)
- Third-party library behavior (trust the library)

Test only:

- Business logic (calculations, state machines, multi-step workflows)
- Authentication and authorization
- Payment flows
- Data mutations (create, update, delete)
- API contracts (request/response shapes, status codes, error handling)
