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
5. If both pass: build and lint verification passed. Continue to Visual Review below — do NOT skip the remaining verification steps.
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

## Auto-Observe (after build passes, before visual review)

If you fixed any build or lint errors above, check for template-rooted issues:

### Step 1: Deterministic scan

Run:
```bash
git diff --name-only | grep -E '^\.(claude/(stacks|commands|patterns)/|scripts/|Makefile$|CLAUDE\.md$)' || true
```

If any template files appear in the diff:
- You directly modified a template file to fix a build error → this IS a template observation
- Proceed to Step 3

### Step 2: LLM evaluation (only if Step 1 found nothing)

If Step 1 found no template files in the diff, but you fixed project code:
ask yourself — "Would another developer using this template with a different
idea.yaml hit this same problem?" If the root cause is incorrect template
guidance (not the template file itself), this still qualifies.

If yes → proceed to Step 3. If no → skip to Save Notable Patterns.

### Step 3: File observation

Follow `.claude/patterns/observe.md` to file a GitHub issue.
Pass the specific template file and error context.

## Visual Review (after Auto-Observe)

Follow the visual review procedure in `.claude/patterns/visual-review.md`.
This screenshots all pages and checks for visual issues that compile-time
checks miss (broken layout, missing fonts, wrong colors, empty pages).
Requires Playwright — skips automatically when not installed.

## Security Review (after visual review passes)

Follow the security review procedure in `.claude/patterns/security-review.md`.
This scans for security issues that compile-time checks miss: hardcoded secrets,
missing input validation, absent RLS policies, and client/server boundary violations.
The security-guidance plugin augments this review when enabled.

## Save Notable Patterns (if you fixed any errors above)

After a successful verification where you fixed build or lint errors:

1. For each error you fixed, decide: is this **universal** or **project-specific**?
   - **Universal** (applies to any project with this stack): add the pattern to the relevant
     `.claude/stacks/<category>/<value>.md` file
   - **Project-specific** (unique to this codebase): save a brief entry to your auto memory
     with the error, cause, and fix
2. Skip if: the error was a simple typo or something unlikely to recur
