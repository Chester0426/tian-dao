# STATE 0: PRE_FLIGHT

**PRECONDITIONS:**
- Git repository exists in working directory
- No branch or PR required (deploy is infrastructure-only)

**ACTIONS:**

1. Verify `package.json` exists. If not, stop: "No app found. Run `/bootstrap` first."
2. Verify on `main` branch with clean working tree (`git status --porcelain` is empty). If not, stop: "Switch to main with a clean working tree before deploying."
3. Run `npm run build` to verify the app builds locally. If it fails, stop: "Fix build errors before deploying."
3a. If `quality: production` is set in experiment.yaml and `stack.testing` is present: run the test command from the testing stack file (e.g., `npm test`). If tests fail, stop: "Specification tests are failing. Run `/verify` to fix test failures before deploying."
3b. **Recovery check:** If `.claude/deploy-manifest.json` exists, read it and report:
    "Previous deploy detected (deployed_at: <timestamp>). Resources may already exist.
    `/deploy` is idempotent — re-running will reuse existing resources and update configuration.
    Reply **continue** to proceed, or run `/teardown` first to start fresh."
    Wait for user confirmation.
3c. **Dependency audit:** Run `npm audit --audit-level=critical`. If critical vulnerabilities are found:
    "Critical npm vulnerabilities detected:
    <npm audit output>
    Reply **continue** to deploy anyway, or fix vulnerabilities first with `npm audit fix`."
    Wait for user confirmation. If no critical vulnerabilities, proceed silently.
4. Read `experiment/experiment.yaml` — extract `name`, `type` (default `web-app`), `stack.database` (if present), optional `stack.payment`, and optional `deploy` section.
5. Read the archetype file at `.claude/archetypes/<type>.md`. Resolve surface type: if `stack.surface` is set in experiment.yaml, use it. Otherwise infer: if the archetype is `service` and the experiment defines no `golden_path` and no endpoints that serve HTML (pure API with no user-facing surface), infer `none`; if the archetype's `excluded_stacks` includes `hosting`, infer `detached`; if the archetype is `service` or `web-app`, check `stack.services[0].hosting` — present -> `co-located`; absent -> `detached`. If the archetype's `excluded_stacks` includes `hosting`:
   - If surface is `detached`: this is a surface-only deployment — skip Steps 0.6–0.10 (no hosting/database infrastructure), Steps 1 and 3–4 (no infrastructure provisioning). Present a simplified plan in Step 2 (surface deployment only), then proceed directly to Step 5a.1.
   - If surface is `none`: stop: "The /deploy skill does not apply to CLI tools with no surface. CLIs are distributed via `npm publish` or GitHub Releases — see the archetype file."
   If the archetype is `service` and surface is `none`: stop: "This is a pure API service with no user-facing surface. The /deploy skill requires a hosting target. Deploy your API manually to your hosting provider of choice, or add `surface: co-located` to experiment.yaml `stack` to use hosting-based deployment. Note: `/iterate` can still analyze your funnel with manual numbers — run it after deploying."
   If `stack.surface` is set in experiment.yaml and the archetype's `excluded_stacks` includes `hosting` and surface is `co-located`: stop: "The `<archetype>` archetype excludes the `hosting` stack, so `surface: co-located` is invalid. Set `stack.surface: detached` for a detached marketing surface, or remove the `surface` field to use the default."
   If the archetype's `excluded_stacks` does not include `hosting`: verify `stack.services` is a non-empty list — if not, stop: "Missing `stack.services` in experiment.yaml. Run `/bootstrap` to set up your project." Then extract `stack.services[0].hosting`.
   The deploy workflow comes from the hosting stack file. For services, browser-based health checks don't apply — use the API health endpoint instead.
> **Surface-only gate:** If the archetype's `excluded_stacks` includes `hosting` and surface is `detached` (resolved in step 5 above), skip Steps 0.6–0.10, Step 1, and Steps 3–4 — proceed to Step 2 (simplified plan), then directly to Step 5a.1. Surface-only deployments for archetypes without hosting have no hosting/database infrastructure.

6. **Hosting prerequisites** (skip for surface-only deployments — see gate in step 5)**:** Read the hosting stack file at `.claude/stacks/hosting/<stack.services[0].hosting>.md` -> `## Deploy Interface > Prerequisites`. Execute each check:
   - Run `install_check` — if not found, stop with `install_fix` instructions
   - Run `auth_check` — if fails, stop with `auth_fix` instructions
7. **Database prerequisites** (skip for surface-only deployments; also skip if `stack.database` is absent)**:** Read the database stack file at `.claude/stacks/database/<stack.database>.md` -> `## Deploy Interface > Prerequisites`. Execute each check:
   - Run `install_check` — if not found, stop with `install_fix` instructions
   - Run `auth_check` — if fails, stop with `auth_fix` instructions
   - If the database has no Prerequisites section (e.g., sqlite), skip
8. **Payment prerequisites:** If `stack.payment: stripe`: `which stripe` — if not found, warn: "Stripe CLI not installed. Webhook will need manual setup. Install: `brew install stripe/stripe-cli/stripe` (macOS) or see https://stripe.com/docs/stripe-cli." If found: `stripe whoami` — if fails, stop: "Run `stripe login` first (one-time per machine)."
9. **Compatibility check** (skip for surface-only deployments)**:** Read the database stack file's `## Deploy Interface > Hosting Requirements > incompatible_hosting`. If the current `stack.services[0].hosting` value appears in the list, stop with the reason from the stack file (e.g., "SQLite is incompatible with Vercel: serverless has no persistent filesystem").
10. Check external service CLIs: For each `.claude/stacks/external/*.md`, read `## CLI Provisioning`. If a CLI is specified:
   - `which <cli>` — record `cli_status: not_installed` (with install command) if not found
   - If found, run auth check — record `cli_status: not_authed` if fails
   - If both pass — record `cli_status: ready`
   - If no `## CLI Provisioning` section found — treat as no CLI (stack file predates CLI metadata)
   - Do NOT stop for missing external CLIs — record status for display in Step 2.

Create `.claude/deploy-context.json` to initialize state tracking:
```bash
cat > .claude/deploy-context.json << CTXEOF
{"skill":"deploy","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","completed_states":[0]}
CTXEOF
```

**POSTCONDITIONS:**
- `package.json` exists
- On `main` branch with clean working tree
- `npm run build` succeeds
- experiment.yaml read and parsed
- Archetype file read and surface type resolved
- All prerequisite checks passed (or appropriate stops issued)
- `.claude/deploy-context.json` exists

**VERIFY:**
```bash
test -f package.json && test -f experiment/experiment.yaml && test -f .claude/deploy-context.json && echo "OK" || echo "FAIL"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh deploy 0
```

**NEXT:** Read [state-1-config-gather.md](state-1-config-gather.md) to continue.
