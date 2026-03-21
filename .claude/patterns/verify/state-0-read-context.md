# STATE 0: READ_CONTEXT

**PRECONDITIONS:** None — this is the entry state.

**ACTIONS:**

1. Clean trace directory (removes stale traces from prior runs):
   ```bash
   rm -rf .claude/agent-traces && mkdir -p .claude/agent-traces
   ```

2. Read context files:
   - Read `experiment/experiment.yaml` — understand pages (from golden_path), behaviors, stack
   - Read `experiment/EVENTS.yaml` — understand tracked events
   - Read the archetype file at `.claude/archetypes/<type>.md` (type from experiment.yaml, default `web-app`)
   - If in bootstrap-verify or change-verify mode: read all files listed in current-plan.md `context_files`
   - If `stack.testing` is present in experiment.yaml, read `.claude/stacks/testing/<value>.md`

3. Write `.claude/verify-context.json` (includes `run_id` for trace freshness validation):
   ```bash
   cat > .claude/verify-context.json << CTXEOF
   {"scope":"<scope>","archetype":"<type>","quality":"<quality|mvp>","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","run_id":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
   CTXEOF
   ```

4. Create `.claude/fix-log.md` on disk:
   ```bash
   echo '# Error Fix Log' > .claude/fix-log.md
   ```

5. Extract context digest (in-memory, passed to agents in STATE 2/3):
   - Pages: list all page names and routes (union of `golden_path` and filesystem scan of `src/app/**/page.tsx`, excluding `/api/`)
   - Behavior IDs: list all behavior IDs from `behaviors`
   - Event names: list event names from `experiment/EVENTS.yaml`
   - Source file list: `find src/ -type f \( -name '*.ts' -o -name '*.tsx' \) | head -100`
   - PR changed files: `git diff --name-only $(git merge-base HEAD main)...HEAD`
   - Golden path steps: ordered list of steps from `golden_path`

**POSTCONDITIONS:** All 4 artifacts exist on disk (agent-traces dir, verify-context.json, fix-log.md). Context digest is available in-memory.

**VERIFY:**
```bash
test -f .claude/verify-context.json && test -f .claude/fix-log.md && test -d .claude/agent-traces
```

> **Hook-enforced:** `phase-transition-gate.sh` validates these postconditions before allowing the next state's agents to spawn.

**NEXT:** Read [state-1-build-lint-loop.md](state-1-build-lint-loop.md) to continue.
