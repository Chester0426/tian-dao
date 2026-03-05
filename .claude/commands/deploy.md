---
description: "Deploy the app. Run once after /bootstrap PR is merged."
type: analysis-only
reads:
  - idea/idea.yaml
  - .env.example
  - CLAUDE.md
  - EVENTS.yaml
stack_categories: [hosting, database, auth, analytics, payment, email]
requires_approval: true
references:
  - .claude/patterns/observe.md
branch_prefix: ""
modifies_specs: false
---
Deploy the app to production by creating cloud infrastructure and deploying via CLI.

This skill automates first-time deployment: provisions the database, creates the hosting project, sets all environment variables, applies migrations, and deploys. No git branch or PR — this is infrastructure-only.

The skill is hosting-agnostic: it reads provider-specific commands from stack file `## Deploy Interface` sections. Adding a new hosting or database provider = adding a stack file with a Deploy Interface. Zero changes to this file.

## Step 0: Validate preconditions

1. Verify `package.json` exists. If not, stop: "No app found. Run `/bootstrap` first."
2. Verify on `main` branch with clean working tree (`git status --porcelain` is empty). If not, stop: "Switch to main with a clean working tree before deploying."
3. Run `npm run build` to verify the app builds locally. If it fails, stop: "Fix build errors before deploying."
4. Read `idea/idea.yaml` — extract `name`, `stack.hosting`, `stack.database`, optional `stack.payment`, and optional `deploy` section.
5. Read the archetype file at `.claude/archetypes/<type>.md` (type from idea.yaml, default `web-app`). If the archetype is `cli`:
   - Resolve surface type: if `stack.surface` is set in idea.yaml, use it. Otherwise infer: `stack.hosting` present → `co-located`; absent → `detached`.
   - If surface is `detached`: proceed with surface-only deployment (skip Steps 3-4, go directly to Step 5 surface deployment).
   - If surface is `none`: stop: "The /deploy skill does not apply to CLI tools with no surface. CLIs are distributed via `npm publish` or GitHub Releases — see the archetype file."
   The deploy workflow comes from the hosting stack file. For services, browser-based health checks don't apply — use the API health endpoint instead.
6. **Hosting prerequisites:** Read the hosting stack file at `.claude/stacks/hosting/<stack.hosting>.md` → `## Deploy Interface > Prerequisites`. Execute each check:
   - Run `install_check` — if not found, stop with `install_fix` instructions
   - Run `auth_check` — if fails, stop with `auth_fix` instructions
7. **Database prerequisites** (if `stack.database` is present): Read the database stack file at `.claude/stacks/database/<stack.database>.md` → `## Deploy Interface > Prerequisites`. Execute each check:
   - Run `install_check` — if not found, stop with `install_fix` instructions
   - Run `auth_check` — if fails, stop with `auth_fix` instructions
   - If the database has no Prerequisites section (e.g., sqlite), skip
8. **Payment prerequisites:** If `stack.payment: stripe`: `which stripe` — if not found, warn: "Stripe CLI not installed. Webhook will need manual setup. Install: `brew install stripe/stripe-cli/stripe` (macOS) or see https://stripe.com/docs/stripe-cli." If found: `stripe whoami` — if fails, stop: "Run `stripe login` first (one-time per machine)."
9. **Compatibility check:** Read the database stack file's `## Deploy Interface > Hosting Requirements > incompatible_hosting`. If the current `stack.hosting` value appears in the list, stop with the reason from the stack file (e.g., "SQLite is incompatible with Vercel: serverless has no persistent filesystem").
10. Check external service CLIs: For each `.claude/stacks/external/*.md`, read `## CLI Provisioning`. If a CLI is specified:
   - `which <cli>` — record `cli_status: not_installed` (with install command) if not found
   - If found, run auth check — record `cli_status: not_authed` if fails
   - If both pass — record `cli_status: ready`
   - If no `## CLI Provisioning` section found — treat as no CLI (stack file predates CLI metadata)
   - Do NOT stop for missing external CLIs — record status for display in Step 2.

## Step 1: Gather configuration

1. **Hosting config**: Read the hosting stack file's `## Deploy Interface > Config Gathering`. Follow the instructions to discover the team/org/account (e.g., run the CLI command listed there). Check the idea.yaml field listed in the stack file — if set, skip the prompt.
2. **Database config** (if `stack.database` is present): Read the database stack file's `## Deploy Interface > Config Gathering`. Follow the instructions to discover the org/region/account. Check the idea.yaml fields listed — if set, skip the prompts.
3. **DB password** (if applicable): Generate with `openssl rand -base64 24`.
5. **Stripe keys** (if `stack.payment` is present): Ask the user for `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. If Stripe CLI is available, the webhook secret will be auto-generated in Step 5. If not, also ask for `STRIPE_WEBHOOK_SECRET`.
6. **External service credentials**: Read `.env.example`, collect env vars not handled by stack categories. For each external service, use CLI status from Step 0.7:
   - **Auto via CLI** — installed + authenticated → will auto-provision in Step 5b
   - **Manual (CLI available)** — CLI exists but not installed/authed → user can install to enable auto
   - **Manual (no CLI)** — no CLI for this service → web dashboard
   - Note: Fake Door features have no env vars and no API routes — UI-only. Skip them.

## Step 2: Present deployment plan — STOP for approval

Present a summary of what will be created:

```
## Deployment Plan

**Hosting (<provider>):** <name> (<team/account info from Config Gathering>)
**Database (<provider>):** <name> (<org/account info from Config Gathering>)
**Environment variables:** <list of env vars to be set>
**Migrations:** <N migration files will be applied>

**External service credentials (post-deploy):**
- [service] — auto via CLI (`<cli>` installed + authed)
- [service] — manual setup — CLI `<cli>` available but not installed (`<install-cmd>`)
- [service] — manual setup (no CLI)
- (Or: "None")

Reply **approve** to proceed, or tell me what to change.
```

**Do not proceed until the user approves.**

## Step 3: Provision database

Skip this step if `stack.database` is absent or if the database stack file's `## Deploy Interface > Provisioning` says "none" (e.g., SQLite — auto-created on startup).

Read the database stack file's `## Deploy Interface > Provisioning` and follow each substep in order. The stack file specifies the exact CLI commands, polling logic, key extraction, and migration commands for the configured database provider.

## Step 4: Create hosting project and set env vars

### 4.1: Project setup

Read the hosting stack file's `## Deploy Interface > Project Setup`. Follow the instructions to create/link the project and connect GitHub for auto-deploy. If the GitHub connection fails, **pause and help the user fix it** — do not skip auto-deploy silently. If unresolvable, set `git_connect_failed=true` (reported in Step 6 summary).

### 4.2: Domain setup

Read the hosting stack file's `## Deploy Interface > Domain Setup`. Follow the instructions to add a custom domain. The default parent domain is `draftlabs.org`; override with `deploy.domain` in idea.yaml.
- **On success:** `canonical_url` = the custom domain, `domain_added` = true
- **On failure:** warn with the stack file's fallback message, set `canonical_url` = null (finalized after Step 5a deploy), `domain_added` = false

### 4.3: Volume setup (if needed)

Read the database stack file's `## Deploy Interface > Hosting Requirements > volume_config`. If `needed: true`:
1. Read the hosting stack file's `## Deploy Interface > Volume Setup`
2. Follow the instructions to create a persistent volume with the specified mount path
3. Set the env vars from `volume_config.env_vars` using the hosting stack file's env var method

If the hosting stack file has no `Volume Setup` section, stop: "Hosting provider <provider> does not support persistent volumes, which are required by <database>."

### 4.4: Set environment variables

Read the hosting stack file's `## Deploy Interface > Environment Variables` for the method (API, CLI, auth token location, fallback).

Collect all env vars and set them using the hosting provider's method:

   Variables from database provisioning (Step 3) — the database stack file's Provisioning substep specifies which env vars and their values.

   Additional variables (when `stack.auth: supabase` AND `stack.database` is NOT `supabase`):
   The auth stack needs a Supabase project even without the database stack. Ask the user for their existing Supabase project URL and anon key:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Dashboard → Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Dashboard → Settings → API → Publishable Key

   Additional variables (when `stack.payment: stripe`):
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET` (skip if Stripe CLI is available — set after webhook creation in Step 5)

   Additional variables (when `stack.email` is present):
   - `RESEND_API_KEY` — ask the user (from resend.com → API Keys)
   - `CRON_SECRET` — generate with `openssl rand -base64 24`

   Additional variables (external service credentials from bootstrap):
   - Read `.env.example` and collect all env var keys
   - Exclude keys already handled by stack categories above (database, Stripe, email, PostHog)
   - For each remaining key: read the value from `.env.local`. If found, set it on the hosting provider. If `.env.local` is missing or the key is absent, ask the user for the production value.

## Step 5: Deploy, configure services, and verify

### 5a: Initial deploy
1. Read the hosting stack file's `## Deploy Interface > Deploy`. Execute the deploy command.
2. Extract the deployment URL per the stack file's instructions.
3. If `canonical_url` is null (domain add failed or no `deploy.domain`): set `canonical_url` = the deployment URL.

### 5a.1: Surface deployment (if archetype is `cli` and surface is `detached`)

1. Verify `site/index.html` exists. If not, stop: "Surface page not found. Run `/bootstrap` to generate it."
2. Deploy the surface using the hosting stack file's `## Deploy Interface > Deploy` command, run from the `site/` directory.
3. Extract the deployment URL per the stack file's instructions.
4. If `deploy.domain` is set in idea.yaml: add custom domain using the hosting stack file's `## Deploy Interface > Domain Setup`.
5. Set `surface_url` = custom domain URL or deployment URL.
6. For CLI archetype: `canonical_url` = `surface_url` (the surface IS the canonical web presence).

### 5b: Post-deploy service configuration (parallel)

Configure services using `canonical_url` (custom domain if added in Step 4.2, otherwise Vercel deployment URL). Up to 4 independent agents run **simultaneously** — each calls a different external API with no shared mutable state.

#### 5b preamble: determine which agents to spawn

Assemble the shared context block (read-only inputs for all agents):
- `canonical_url`, hosting env var method (from hosting stack file's `## Deploy Interface > Environment Variables`), database refs/keys (from Step 3), hosting project `name` and team/account (from Step 4)
- Hosting and database stack file paths (so agents can read provider-specific instructions)
- idea.yaml contents (name, title, variants, stack, type), `EVENTS.yaml` contents, archetype `funnel_template`
- CLI statuses from Step 0

Determine which agents to launch based on idea.yaml stack (all use
`subagent_type: general-purpose`):
- **Agent A** (Supabase Auth): spawn if `stack.auth: supabase` AND `stack.database: supabase`
- **Agent B** (Stripe Webhook): spawn if `stack.payment: stripe` AND Stripe CLI is available
- **Agent C** (Analytics Dashboard): spawn if `stack.analytics: posthog`
- **Agent D** (External Services): spawn if any external stack files exist (Step 0.8 found services)

Launch all applicable agents **simultaneously** using parallel Agent tool calls. Each agent returns a result object: `{status, message, env_vars_added, ...}`.

---

#### Agent A — Database Auth config

**Spawn condition:** `stack.auth: supabase` AND `stack.database: supabase`
**Receives:** `canonical_url`, database refs/keys (from Step 3), idea.yaml `title`/`name`, database stack file path
**Returns:** `{status: "ok"|"failed"|"skipped", message: "<details>", env_vars_added: []}`

Instructions for Agent A:

Read the database stack file's `## Deploy Interface > Auth Config`. If the section is absent (database provider has no auth config), return `{status: "skipped", message: "Database provider has no auth config section.", env_vars_added: []}`.

If `stack.database` does not match `stack.auth`'s expected database (e.g., auth is supabase but no supabase project was created in Step 3), return `{status: "skipped", message: "Auth redirect URLs must be configured manually since no matching database project was created during deploy.", env_vars_added: []}`.

Follow the Auth Config section's instructions step by step — it specifies how to discover the access token, what API call to make, and what fields to set using `canonical_url`.

---

#### Agent B — Stripe Webhook

**Spawn condition:** `stack.payment: stripe` AND Stripe CLI is available
**Receives:** `canonical_url`, hosting env var method (from hosting stack file), hosting project `name`/team, hosting stack file path
**Returns:** `{status: "ok"|"failed"|"skipped", message: "<details>", env_vars_added: ["STRIPE_WEBHOOK_SECRET"]|[]}`

Instructions for Agent B:

Check for existing endpoint: `stripe webhook_endpoints list` — if an endpoint with URL `https://<canonical_url>/api/webhooks/stripe` already exists, return `{status: "ok", message: "Stripe webhook already exists.", env_vars_added: []}`.
Otherwise:
```bash
stripe webhook_endpoints create \
  --url "https://<canonical_url>/api/webhooks/stripe" \
  --events checkout.session.completed
```
Extract the webhook signing secret (`whsec_...`) from the output. Set it using the hosting stack file's `## Deploy Interface > Environment Variables` method (primary method with fallback).

Return `{status: "ok", message: "Stripe webhook created and secret set.", env_vars_added: ["STRIPE_WEBHOOK_SECRET"]}`.
If webhook creation fails, return `{status: "failed", message: "<error details>", env_vars_added: []}`.

---

#### Agent C — Analytics Dashboard

**Spawn condition:** `stack.analytics: posthog`
**Receives:** `canonical_url`, idea.yaml `name`/`title`/`variants`, archetype `funnel_template`, `EVENTS.yaml` content, `stack.payment` presence
**Returns:** `{status: "ok"|"failed"|"skipped", message: "<details>", dashboard_url: "<url>"|null, env_vars_added: []}`

Instructions for Agent C:

Read the PostHog personal API key from `~/.posthog/personal-api-key` (same credential used by /iterate auto-query).

If the key does NOT exist:
1. Tell the user: "PostHog personal API key not found at `~/.posthog/personal-api-key`. To auto-create the experiment dashboard, create one now:"
   - Go to PostHog → click your profile (bottom left) → **Personal API keys**
   - Click **Create personal API key**
   - Label: `cli` (or anything)
   - Organization & project access: select your organization
   - Scopes: set **Dashboards** to **Write** and **Insights** to **Write** (all others can stay No access)
   - Click **Create key** and copy the key
2. Ask: "Paste the key here, or type **skip** to set up the dashboard manually later."
3. If key provided: save to `~/.posthog/personal-api-key` (`mkdir -p ~/.posthog && echo "$KEY" > ~/.posthog/personal-api-key`) and proceed with auto-creation below.
4. If skipped: return `{status: "skipped", message: "PostHog dashboard not auto-created — manual setup needed.", dashboard_url: null, env_vars_added: []}`.

If the key exists (or was just created), auto-create a dashboard via PostHog API:

First, discover the PostHog project ID:
```bash
POSTHOG_PROJECT_ID=$(curl -s "https://us.i.posthog.com/api/projects/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" | python3 -c "import sys,json; print(json.load(sys.stdin)['results'][0]['id'])")
```

```bash
# Create dashboard
curl -s -X POST "https://us.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/dashboards/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "<idea.name> Experiment", "description": "Auto-created by /deploy for <idea.title>"}'
```

Extract the dashboard `id` from the response. Then create funnel insight. **Choose the funnel series based on the archetype's `funnel_template`:**

- If `funnel_template: web` (web-app): use `visit_landing → signup_start → signup_complete → activate`. Add `pay_start` and `pay_success` if `stack.payment` is present.
- If `funnel_template: custom` (service): read EVENTS.yaml `custom_events`. If non-empty, use those events as the funnel series. If empty, use `activate → retain_return` as the minimal service funnel.

```bash
# Create funnel insight and add to dashboard
curl -s -X POST "https://us.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "<idea.name> Funnel", "dashboards": [<dashboard_id>], "query": {"kind": "InsightVizNode", "source": {"kind": "FunnelsQuery", "series": [<archetype-appropriate EventsNode entries>], "filterTestAccounts": true, "properties": {"type": "AND", "values": [{"type": "AND", "values": [{"key": "project_name", "value": ["<idea.name>"], "operator": "exact", "type": "event"}]}]}}}}'
```

If idea.yaml has `variants` (web-app only): create a second funnel insight named `<idea.name> Funnel by Variant` on the same dashboard, with the same series and filters as above, plus a breakdown:
```bash
curl -s -X POST "https://us.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "<idea.name> Funnel by Variant", "dashboards": [<dashboard_id>], "query": {"kind": "InsightVizNode", "source": {"kind": "FunnelsQuery", "series": [<same web-app series>], "filterTestAccounts": true, "breakdownFilter": {"breakdown": "variant", "breakdown_type": "event"}, "properties": {"type": "AND", "values": [{"type": "AND", "values": [{"key": "project_name", "value": ["<idea.name>"], "operator": "exact", "type": "event"}]}]}}}}'
```
Include `pay_start` and `pay_success` in the series if `stack.payment` is present. This lets the user compare conversion rates between variant landing pages — the core purpose of the variants feature.

If any API call fails, return `{status: "failed", message: "<error details>", dashboard_url: null, env_vars_added: []}`. Include manual instructions in Step 6.
If all API calls succeed, return `{status: "ok", message: "Dashboard and funnel insights created.", dashboard_url: "<PostHog dashboard URL>", env_vars_added: []}`.

---

#### Agent D — External Services

**Spawn condition:** any external stack files exist (Step 0.8 found services)
**Receives:** `canonical_url`, hosting env var method (from hosting stack file), hosting project `name`/team, hosting stack file path, external CLI statuses from Step 0.10, external stack file paths
**Returns:** `{status: "ok"|"partial"|"failed"|"skipped", message: "<details>", env_vars_added: ["KEY1", ...], per_service: [{name, status, message}]}`

Instructions for Agent D:

For each external service (using CLI status from Step 0.10):

**Auto via CLI** (ready): Read `## CLI Provisioning` from external stack file → execute provision command with canonical URL → extract credentials → set env vars using the hosting stack file's `## Deploy Interface > Environment Variables` method. If provisioning fails: tell user "[service] CLI provisioning failed: [error]. Falling back to manual setup." Then proceed to Manual setup.

**Manual (CLI available)** (not_installed/not_authed): Tell user: "[service] has CLI `<cli>` for auto-provisioning. Install: `<install-cmd>`. Or provide credentials manually now." Then proceed to Manual setup.

**Manual setup** (shared path for "CLI available", "no CLI", and auto-provision failures): Read external stack file for instructions. Provide step-by-step guidance:
- Where to create credentials (include URL)
- Canonical URL for redirect URIs (e.g., `https://<canonical_url>/api/auth/callback/<service>`)
- Which values to copy
- Ask for credentials, or offer **skip** — feature returns 503 until configured via the hosting provider's env var CLI
- Set env vars using the hosting stack file's env var method

Collect all env vars added across all services. Return `{status, message, env_vars_added: [...all keys set...], per_service: [{name, status, message}, ...]}`.

---

#### 5b post-join: collect results

**Wait for all agents to complete before continuing.**

1. Collect `env_vars_added` arrays from all agent results into a single list.
2. Collect `dashboard_url` from Agent C result (for Step 6 summary).
3. Collect per-agent `status` and `message` (for Step 6 summary).
4. Collect `per_service` from Agent D result (for Step 6 external services section).

#### 5b.5: Redeploy (only if any agent reported non-empty `env_vars_added`)

Read the hosting stack file's `## Deploy Interface > Deploy` and execute the deploy command.

Note: projects with Stripe require two production deploys during first-time setup (one to get the URL, one after webhook secret is configured). Subsequent deploys via git push need only one.

### 5c: Health check

```bash
curl -s <canonical_url>/api/health
```
Parse the JSON response. Each service returns `"ok"` or an error message.

If all checks pass → proceed to Step 6.

### 5d: Auto-fix (max 1 round)

If any health check fails, diagnose and attempt to fix:

| Check | Diagnosis | Auto-fix |
|-------|-----------|----------|
| `database` | Re-extract keys using database stack file's Provisioning steps. Compare with hosting stack file's `## Deploy Interface > Auto-Fix` verify command. | If mismatch: re-set env vars using hosting stack file's env var method, then redeploy |
| `auth` | Re-check auth config via database stack file's `## Deploy Interface > Auth Config` | Re-run the auth config step |
| `analytics` | Code integration issue — cannot fix via CLI | Report: "Analytics health check failed. This is likely a code issue — merge the current PR to `main`, pull (`git checkout main && git pull`), then run `/change fix analytics integration`." |
| `payment` | Verify webhook: `stripe webhook_endpoints list`. Check env var using hosting stack file's Auto-Fix verify command. | Re-set env vars if missing/wrong, redeploy |

After all fixable issues are addressed:
- If any env vars were changed → batch into a single redeploy using the hosting stack file's `## Deploy Interface > Deploy` command
- Re-run health check: `curl -s <canonical_url>/api/health`

If still failing after 1 fix round → report precise per-service diagnosis with actionable next steps.

### 5d.5: Provision scan (independent verification)

Spawn the `provision-scanner` agent (`subagent_type: provision-scanner`).
Pass context:

> Mode: deploy
> Manifest path: .claude/deploy-manifest.json

Wait for the agent to complete. Include the scanner's output table in the Step 6 summary under a **Provision Scan** heading. If any check FAILs, list them as action items — the health check + auto-fix (5c–5d) already attempted remediation, so these are residual issues for the user to address.

### 5e: File template observations

If any fix during the deploy flow (Steps 3–5d) required working around a
problem whose root cause is in a template file (stack file, command file,
or pattern file), follow `.claude/patterns/observe.md` to file an
observation issue. This captures deployment-specific template gaps that
verify.md's build loop would not encounter.

Do NOT file observations for environmental issues (missing/mistyped env
vars, temporary network outages, uninitialized CLIs, or authentication
failures) — observe.md's trigger evaluation excludes these.

## Step 6: Summary

Print a deployment summary:

```
## Deployment Complete

**Live URL:** https://<canonical_url>
**Database Dashboard:** <URL from database stack file's `## Deploy Interface > Teardown` dashboard URL>
**Hosting Dashboard:** <URL from hosting stack file's `## Deploy Interface > Teardown` dashboard URL>

**Surface URL:** https://<surface_url>
**Health check:** [show per-service results — e.g., database: ok, auth: ok, analytics: ok, payment: ok]

**Auto-deploy:** [If git_connect_failed] Not configured — see hosting stack file's Project Setup for GitHub connection instructions. [Else] Active — merges to main auto-deploy to production.
**Auto-migrate:** [If database has migrations] Active — migrations are applied per the database stack file's conventions.

[If domain add succeeded] **Custom domain:** https://<name>.<domain>
[If domain add failed] **Custom domain (manual):** See hosting stack file's `## Deploy Interface > Domain Setup` for the add-domain command and DNS requirements.

[If auth] **Auth redirect URLs:** Configured — site_url set to https://<canonical_url>
[If auth] **Email subjects:** Configured — confirmation, recovery, and magic link emails use app name
[If payment AND Stripe CLI was available] **Stripe webhook:** Configured — endpoint https://<canonical_url>/api/webhooks/stripe, events: checkout.session.completed
[If payment AND Stripe CLI was NOT available] **Stripe webhook (manual):** Add the webhook URL in Stripe Dashboard → Developers → Webhooks:
  Endpoint URL: https://<canonical_url>/api/webhooks/stripe
  Events: checkout.session.completed
[If any health check failed] **Action needed:** [list failing services with fix commands]

[If external services] **External services:**
- [service]: ✅ auto-provisioned via CLI / ✅ manually configured / ❌ not configured — set via hosting provider's env var CLI
[If none] **External services:** None

[If PostHog dashboard was auto-created] **Analytics dashboard:** <dashboard_url>
[If PostHog dashboard was NOT auto-created] **Analytics dashboard (manual):**
  1. Go to PostHog → Dashboards → New dashboard → name it "<idea.name> Experiment"
  2. Add a Funnel insight: visit_landing → signup_start → signup_complete → activate [→ pay_start → pay_success if payment]. Filter by project_name = "<idea.name>".
  If idea.yaml has `variants`: add a second Funnel insight with the same events, but add Breakdown → Event property → `variant`. Name it "<idea.name> Funnel by Variant".
  3. Add a Trend insight: all standard_funnel events, daily, last 14 days, filtered by project_name.

**Scheduled digest (recommended):** In PostHog → Dashboards → "<idea.name> Experiment" → click "Subscribe" (bell icon) → set frequency to every 3 days → add your email. You'll receive funnel charts by email automatically — no need to remember to check.

**Next steps** (all optional — pick what fits your experiment):
[If web-app archetype]
1. Share the live URL with target users and gather initial feedback
2. Run `/distribute` to generate ad campaign config (only if using paid ads)
3. After collecting data, run `/iterate` to analyze metrics and decide what to change
4. When the experiment ends, run `/retro` to file a retrospective, then `/teardown` to remove cloud resources
[If service archetype]
1. Share the API endpoint URL with target users (see `.claude/archetypes/service.md` Distribution section)
2. After collecting data, run `/iterate` to analyze metrics and decide what to change
3. When the experiment ends, run `/retro` to file a retrospective, then `/teardown` to remove cloud resources
[If cli archetype]
1. The surface is now deployed, but the CLI binary is NOT published yet. Publish via `npm publish` (to npm registry) or create a GitHub Release for binary distribution. See `.claude/archetypes/cli.md` for details.
2. After publishing and collecting usage data, run `/iterate` to analyze metrics and decide what to change
3. When the experiment ends, run `/retro` to file a retrospective
```

### Write deploy manifest

Write `.claude/deploy-manifest.json` with the resources created during this deploy:

```json
{
  "name": "<idea.yaml name>",
  "canonical_url": "<canonical_url>",
  "hosting": {
    "provider": "<stack.hosting value>",
    ...provider-specific keys from hosting stack file's `## Deploy Interface > Manifest Keys`
  },
  "database": {
    "provider": "<stack.database value>",
    ...provider-specific keys from database stack file's `## Deploy Interface > Manifest Keys`
  },
  "posthog": {
    "dashboard_id": "<id or null>"
  },
  "stripe": {
    "webhook_endpoint_url": "<url or null>"
  },
  "surface_url": "<url or null>",
  "external_services": ["<service-slug>", ...],
  "deployed_at": "<ISO 8601 timestamp>"
}
```

Omit sections for inactive stack categories (e.g., no `database` key if `stack.database` is absent). The `hosting.provider` and `database.provider` fields tell `/teardown` which stack file to load for teardown commands. This manifest is consumed by `/teardown` to identify what to delete.

If the write fails, warn but continue — the manifest is for convenience, not correctness.

## Idempotency

This skill handles re-runs gracefully:
- Hosting project setup is idempotent (stack file commands reuse existing projects)
- Environment variable methods use upsert/overwrite semantics (per hosting stack file)
- Database provisioning checks for existing projects before creating
- Database migrations skip already-applied migrations
- Auth config is idempotent — overwrites existing values
- Stripe webhook creation checks for existing endpoint before creating
- Stripe CLI is a soft dependency — falls back to manual setup if not installed
- Domain add commands are idempotent — adding an already-configured domain is a no-op
- Re-running `/deploy` overwrites `.claude/deploy-manifest.json` with current resource state
- Post-deploy service configuration (5b) runs agents in parallel — each agent operates on a different external API with no cross-agent state, preserving all idempotency guarantees

## Do NOT

- Create a git branch or PR — this is infrastructure-only
- Modify any source code files
- Store secrets in code or commit them
- Skip the approval step — the user must review the plan before resources are created
- Proceed if CLI auth checks fail — always stop and tell the user which login command to run
