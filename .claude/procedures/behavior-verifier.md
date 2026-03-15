# Behavior Verifier Procedure

> Executed by the behavior-verifier agent. See `.claude/agents/behavior-verifier.md` for identity, failure taxonomy, and output contract.

## Archetype Gate

Read `experiment/experiment.yaml` to determine the archetype (`type` field, default: `web-app`) and `golden_path`.

---

## Procedure: web-app

### 1. Prerequisite

Run `npx playwright --version`. If it fails, return:
> Skipping behavior verification — Playwright not installed.

### 2. Start Server

```bash
DEMO_MODE=true NEXT_PUBLIC_DEMO_MODE=true npm run start -- -p 3097 &
```

Poll `http://localhost:3097` until it responds (max 15 seconds, then abort).

### 3. Walk Golden Path (State Machine)

Write an inline Playwright script that walks each `golden_path` step **in a single browser context** — never create a fresh context between steps. The golden path is a connected journey; state must carry forward.

Read `experiment/experiment.yaml` `golden_path` and `behaviors` to determine inputs, expected outcomes, and state transitions for each step.

For each step:

1. **Navigate/interact** as specified by the golden path
2. **Capture evidence**: screenshot to `/tmp/behavior-verify/<step-N>.png`, current URL, HTTP status, all console errors/warnings
3. **Assert expected outcome**: correct redirect, success message, expected UI state
4. **Verification probe** (after critical mutations): make a second request to verify state persisted
   - After signup/login: reload page, verify session holds (not redirected to login)
   - After form submit: navigate to list/detail view, verify item appears
   - After settings change: reload, verify setting persists
5. **Classify result**: pass / FAIL [B1-B6] / degraded / skipped

### 4. Error Paths

For each page with a form, test **one invalid input**:
- Submit empty required field, or malformed email, or out-of-range value
- Assert: validation error shown (field-specific, not generic crash), no 500, form still usable after error

### 5. Quality Gate

- **MVP** (`quality` absent): Happy path + 1 error path per form page.
- **Production** (`quality: production`): Also test edge cases — special characters in text inputs (`<script>`, unicode), very long text (>1000 chars), boundary values for numeric inputs, rapid double-submit on forms.

### 6. System Behavior Smoke

For `behaviors` with `actor: system` or `actor: cron`:
- Do NOT simulate triggers (cron jobs, webhooks)
- Verify handler exists: grep for the route/function
- If it's an API endpoint: POST with empty body → expect 400 or 401 (not 500 or 404)
- Classify: pass (handler exists + responds) / FAIL [B1] (500 or 404) / skipped (no endpoint to probe)

### 7. Cleanup

```bash
kill %1 2>/dev/null || true
rm -rf /tmp/behavior-verify
```

---

## Procedure: service

### 1. Start Server

Start the server using the project's start command on port 3097.

### 2. Walk Golden Path (State Machine)

For each `golden_path` step, test the corresponding API endpoint **sequentially** — responses from step N inform requests to step N+1 (e.g., auth token from login used in subsequent requests).

For each step:

1. **Send request** via `curl` with appropriate method, headers, body
2. **Capture evidence**: full response (status + headers + body), expected vs actual
3. **Assert outcome**: correct status code, response shape matches expected structure, state mutation verifiable
4. **Verification probe**: after mutations, read back the data (GET after POST/PUT) to confirm persistence
5. **Classify result**: pass / FAIL [B1-B6] / degraded / skipped

### 3. Error Paths

For each endpoint:
1. **Invalid input** → assert 4xx (not 500), error message is descriptive and field-specific
2. **Missing/invalid auth** (if auth exists) → assert 401 or 403 (not 200 or 500)

### 4. Quality Gate

- **MVP**: Happy path + 1 invalid input per endpoint.
- **Production**: Also test missing fields, wrong types, boundary values, empty arrays vs null.

### 5. System Behavior Smoke

Same as web-app: verify handlers exist for system/cron behaviors, probe endpoints.

### 6. Cleanup

Kill the server process.

---

## Procedure: cli

### 1. Build

Run the project's build command to produce the CLI binary/entry point.

### 2. Walk Golden Path (State Machine)

For each `golden_path` step:

1. **Run command** with specified arguments
2. **Capture evidence**: exit code, full stdout, full stderr
3. **Assert outcome**: exit code 0, expected output contains key content, side effects verifiable (files created, output written)
4. **Verification probe**: after mutations (file create, config write), verify the artifact exists and contains expected content
5. **Classify result**: pass / FAIL [B1-B6] / degraded / skipped

### 3. Error Paths

For each command:
1. **Invalid args** → assert non-zero exit code, human-readable error message (not stack trace)
2. **Missing required args** → assert non-zero exit code, usage hint shown

### 4. Quality Gate

- **MVP**: Happy path + 1 invalid arg per command.
- **Production**: Also test missing required args, conflicting flags, edge case inputs (empty string, very long args, special characters).
