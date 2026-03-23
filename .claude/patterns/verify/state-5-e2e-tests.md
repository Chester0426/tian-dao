# STATE 5: E2E_TESTS

**PRECONDITIONS:** STATE 4 complete (or skipped for visual/build scope).

**ACTIONS:**

- If `stack.testing` is NOT present in experiment.yaml → write `.claude/e2e-result.json`:
  ```bash
  echo '{"skipped":true,"reason":"no testing stack"}' > .claude/e2e-result.json
  ```
  Skip to STATE 6.

- If `stack.testing` is present but no test configuration file exists → write `.claude/e2e-result.json`:
  ```bash
  echo '{"skipped":true,"reason":"no test configuration"}' > .claude/e2e-result.json
  ```
  Skip to STATE 6.

- Otherwise: run E2E tests with precondition separation.

  **Phase A: Config validation (max 2 attempts, NOT counted against test budget)**

  1. Run: `timeout 30 npx playwright test --list 2>&1`
  2. If `--list` succeeds (exit 0, lists test names): proceed to Phase B.
  3. If config error (output contains `browserType`, `chromium`, `Cannot find module`, `config`, or `Error: playwright`):
     - These are infrastructure issues, not test failures.
     - Fix the config error (e.g., install missing browser, fix config path).
     - Append fix to `.claude/fix-log.md`: `Fix (e2e-config): <file> — <description>`
     - Re-run `--list` (max 2 config-fix attempts total).
  4. If test file error (syntax errors in test files, missing imports in tests): proceed to Phase B — these count against the test budget.
  5. If config errors persist after 2 attempts, write `.claude/e2e-result.json`:
     ```bash
     echo '{"passed":false,"attempts":0,"config_error":true,"reason":"playwright config broken after 2 fix attempts"}' > .claude/e2e-result.json
     ```
     Skip to STATE 6.

  **Phase B: Test execution (3-attempt budget, starts ONLY after --list succeeds)**

  For each failed attempt:
  1. Read test output, identify failures
  2. Fix issues (test code or app code)
  3. Append each fix to `.claude/fix-log.md`: `Fix (e2e): <file> — <description>`
  4. Re-run tests

  After tests pass (or 3-attempt budget exhausted), write `.claude/e2e-result.json`:
  ```bash
  cat > .claude/e2e-result.json << 'E2EEOF'
  {"passed":<true|false>,"attempts":<N>,"fixes":<N>,"config_attempts":<CA>}
  E2EEOF
  ```

**POSTCONDITIONS:** `e2e-result.json` exists.

**VERIFY:**
```bash
test -f .claude/e2e-result.json
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh 5
```

**NEXT:** Read [state-6-auto-observe.md](state-6-auto-observe.md) to continue.
