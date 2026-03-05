# Verification Procedure

Run this procedure after making code changes and before committing.

> **Do NOT skip this procedure.** Do NOT claim the build passes without running it. Do NOT commit without a passing build. There are no exceptions.

## Build & Lint Loop (max 3 attempts)

You have a budget of **3 attempts** to get a clean build and lint. Track each failed
attempt so you can reference previous errors and avoid repeating them.

For each attempt:

1. Run `npm run build`
2. If build fails: note the errors (mentally log: "Attempt N — build: [error summary]").
   Fix the errors, then start the next attempt.
3. If build passes: run `npm run lint` (skip if no lint script exists).
   Warnings are OK; errors are not.
4. If lint fails: note the errors (mentally log: "Attempt N — lint: [error summary]").
   Fix the errors, then start the next attempt.
5. If both pass: build and lint verification passed. Continue to Parallel Review below — do NOT skip the remaining verification steps.
6. **Prove it.** Quote the last 3–5 lines of the build output in your response. State facts: "Build completed with 0 errors. Lint passed with 0 warnings." Never say "should work", "probably passes", or "seems fine."

**If all 3 attempts fail**, stop and report to the user:

> **Build verification failed after 3 attempts.** Here's what I tried:
>
> - Attempt 1: [what failed and what I changed]
> - Attempt 2: [what failed and what I changed]
> - Attempt 3: [what still fails]
>
> The remaining errors are: [paste current errors]
>
> **Your options:**
> 1. **Tell me what to try** — describe the fix and I'll implement it on this branch
> 2. **Save and investigate later** — run `git add -A && git commit -m "WIP: build not passing yet"`, then `git checkout main`. Your WIP is safe on the feature branch. Resume later with `git checkout <branch>` and tell me the remaining errors.
> 3. **Start fresh** — run `git add -A && git commit -m "WIP: discarding"`, then `git checkout main`, then `make clean`, then `/bootstrap`. **Warning:** `make clean` deletes all generated code — only committed code is preserved in git history.
> 4. **Debug on this branch later** — switch to this branch (`git checkout <branch>`) and describe the remaining build errors directly. Do not re-run `/bootstrap` or `/change` — those create new branches. Just tell Claude what errors remain and it will fix them here.

Do NOT commit code that fails build or lint. Do NOT skip this procedure.

## Parallel Review (after build passes)

Spawn **three agents simultaneously** using parallel Agent tool calls. All three
read already-built code and have no data dependencies on each other.

### Agent A — Auto-Observe

> If build/lint errors were fixed above, follow `.claude/patterns/observe.md` to
> evaluate and file template observations. Use the build-error context from the
> Build & Lint Loop above. If no errors were fixed, report "nothing to observe".

This agent only files GitHub issues — it never modifies code.

### Agent B — Visual Review (scan only)

> Follow `.claude/patterns/visual-review.md` **Steps 1 through 4 only**. Start the
> production server, screenshot all pages, review screenshots. **Do NOT fix any
> issues** (skip Step 5). Report your findings: list of issues per page, or "all
> pages pass". **Clean up:** kill the server on port 3099 and remove screenshots
> when done.

### Agent C — Security Review (scan only)

> Follow `.claude/patterns/security-review.md` **Steps 1 and 2 only**. Run the
> plugin check or manual fallback checklist. **Do NOT fix any issues** (skip
> Step 3). Report your findings: pass/FAIL per check, with details for any FAIL.

**Wait for all three agents to complete before continuing.**

## Sequential Fix Cycles (if needed)

If Agent B reported visual issues:
1. Follow `.claude/patterns/visual-review.md` Step 5 (Fix Cycle, max 2 cycles):
   fix code, rebuild, re-screenshot, re-review.
2. Follow `.claude/patterns/visual-review.md` Step 6 (Cleanup).

If Agent C reported security issues:
1. Follow `.claude/patterns/security-review.md` Step 3 (Fix Cycle, max 2 cycles):
   fix code, rebuild, re-check.
2. Follow `.claude/patterns/security-review.md` Step 4 (Report).

If neither agent reported issues, skip this section.

## Save Notable Patterns (if you fixed any errors above)

After a successful verification where you fixed build or lint errors:

1. For each error you fixed, decide: is this **universal** or **project-specific**?
   - **Universal** (applies to any project with this stack): add the pattern to the relevant
     `.claude/stacks/<category>/<value>.md` file
   - **Project-specific** (unique to this codebase): save a brief entry to your auto memory
     with the error, cause, and fix
2. Skip if: the error was a simple typo or something unlikely to recur
