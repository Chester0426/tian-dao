# /change: Fix Implementation

> Invoked by change.md Step 6 when type is Fix.
> Read the full change skill at `.claude/commands/change.md` for lifecycle context.

## Prerequisites from change.md

- idea.yaml and EVENTS.yaml have been read (Step 2)
- Change classified as Fix (Step 3)
- Preconditions checked (Step 4)
- Plan approved (Phase 1)
- Specs updated (Step 5)

## Implementation

- If `quality: production` is set in idea.yaml:
  1. Write regression test demonstrating the bug (fails on current code) per `patterns/tdd.md` § Regression Tests
  2. Fix root cause (minimal change)
  3. Verify test passes
  4. Continue to Step 7
- If `quality` is absent or `mvp` (default):
- Make the minimal change needed — smaller diffs are easier to review
- Fix only the root cause, no refactoring of surrounding code
- If the fix touches auth or payment code: add or update a test (per CLAUDE.md Rule 4)
- Check that analytics events on modified pages are still intact
