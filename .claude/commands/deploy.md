---
description: "Deploy the app to Vercel + Supabase. Run once after /bootstrap PR is merged."
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

This skill automates first-time deployment: creates a Supabase project, creates a Vercel project, sets all environment variables, applies migrations, and deploys. No git branch or PR — this is infrastructure-only.

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
6. Verify `stack.hosting` is `vercel`. If not, stop: "Only Vercel hosting is automated by /deploy. For your hosting provider, read `.claude/stacks/hosting/<value>.md` for CLI setup and deployment steps."
7. Check CLI installation and auth (check install first, then auth — they are different failures with different fixes):
   - `which vercel` — if not found, stop: "Vercel CLI not installed. Install: `npm i -g vercel`"
   - `vercel whoami` — if fails, stop: "Run `vercel login` first (one-time per machine)."
   - If `stack.database: supabase`: `which supabase` — if not found, stop: "Supabase CLI not installed. Install: `brew install supabase/tap/supabase` (macOS/Linux) or see https://supabase.com/docs/guides/cli/getting-started"
   - If `stack.database: supabase`: `supabase projects list` — if fails, stop: "Run `supabase login` first (one-time per machine)."
   - If `stack.payment: stripe`: `which stripe` — if not found, warn: "Stripe CLI not installed. Webhook will need manual setup. Install: `brew install stripe/stripe-cli/stripe` (macOS) or see https://stripe.com/docs/stripe-cli." If found: `stripe whoami` — if fails, stop: "Run `stripe login` first (one-time per machine)."
8. Check external service CLIs: For each `.claude/stacks/external/*.md`, read `## CLI Provisioning`. If a CLI is specified:
   - `which <cli>` — record `cli_status: not_installed` (with install command) if not found
   - If found, run auth check — record `cli_status: not_authed` if fails
   - If both pass — record `cli_status: ready`
   - If no `## CLI Provisioning` section found — treat as no CLI (stack file predates CLI metadata)
   - Do NOT stop for missing external CLIs — record status for display in Step 2.

## Step 1: Gather configuration

1. **Vercel team**: Read `deploy.vercel_team` from idea.yaml. If not set, run `vercel teams list` and ask the user to pick one (or use personal account).
2. **Supabase org** (if `stack.database: supabase`): Read `deploy.supabase_org` from idea.yaml. If not set, run `supabase orgs list -o json` and ask the user to pick one.
3. **Supabase region**: Read `deploy.supabase_region` from idea.yaml, or default to `us-east-1`.
4. **DB password**: Generate with `openssl rand -base64 24`.
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

**Vercel project:** <name> (team: <team>)
**Supabase project:** <name> (org: <org>, region: <region>)
**Environment variables:** <list of env vars to be set>
**Migrations:** <N files in supabase/migrations/ will be applied>

**External service credentials (post-deploy):**
- [service] — auto via CLI (`<cli>` installed + authed)
- [service] — manual setup — CLI `<cli>` available but not installed (`<install-cmd>`)
- [service] — manual setup (no CLI)
- (Or: "None")

Reply **approve** to proceed, or tell me what to change.
```

**Do not proceed until the user approves.**

## Step 3: Create Supabase project

Skip this step if `stack.database` is not `supabase`.

1. Check if a Supabase project with this name already exists in the org (`supabase projects list -o json`). If it does, ask the user whether to reuse it or create a new one.
2. Create the project:
   ```bash
   supabase projects create <name> --org-id <org-id> --region <region> --db-password <password>
   ```
3. Extract the project ref from the creation output.
4. Poll for readiness — the project takes ~60s to initialize:
   ```bash
   supabase projects api-keys --project-ref <ref> -o json
   ```
   Poll every 5s, max 12 attempts (60s total). If it times out, tell the user to wait and retry.
5. Extract keys from the API response:
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
6. Construct URLs:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `POSTGRES_URL_NON_POOLING`: query the pooler config to get the correct hostname. **Important:** query this AFTER Step 3.4 confirms the project is ACTIVE_HEALTHY. The pooler API may lag behind the project status API by several seconds.
     ```bash
     curl -s "https://api.supabase.com/v1/projects/<ref>/config/database/pooler" \
       -H "Authorization: Bearer <token>"
     ```
     If the response is empty (`[]`), wait 5s and retry (max 3 attempts). If still empty after 3 attempts, stop: "Pooler config not available yet. Wait a minute and re-run `/deploy`."
     Use the `host` from the response with port `5432` (session mode = direct connection):
     `postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres`
7. Link the local project:
   ```bash
   supabase link --project-ref <ref>
   ```
8. Apply migrations (if `supabase/migrations/` has files):
   ```bash
   supabase db push --yes
   ```

## Step 4: Create Vercel project and set env vars

1. Link/create the Vercel project:
   ```bash
   vercel link --yes --project <name> --scope "<team>"
   ```
   If the project already exists, `vercel link` will connect to it (idempotent).

2. **Resolve canonical URL**:

   The default parent domain is `draftlabs.org`. If `deploy.domain` is set in idea.yaml, use that instead.
   Construct the full domain: `<idea.yaml name>.<domain>` (e.g., `quickbill.draftlabs.org`).

   Attempt to add the domain to the Vercel project (requires only the project to exist, not a deployment):
   ```bash
   vercel domains add <name>.<domain> --scope "<team>"
   ```

   - If this succeeds: `canonical_url` = `<name>.<domain>`, `domain_added` = true. The custom domain is live (wildcard DNS is pre-configured).
   - If this fails: warn "Could not add custom domain. Verify that wildcard DNS is configured for <domain> (CNAME `*` → `cname.vercel-dns.com`, DNS Only). Will use Vercel deployment URL instead." Set `canonical_url` = null, `domain_added` = false.

   `canonical_url` is finalized after Step 5a deploy if still null.

3. Connect GitHub repo for auto-deploy:
   ```bash
   vercel git connect --yes
   ```
   If this fails, **pause and help the user fix it** — do not skip auto-deploy silently. Diagnose the error:
   - "Login Connection" error → Tell the user: "Go to https://vercel.com/account/settings/authentication → Connect GitHub. Tell me when done." Wait for user confirmation, then retry `vercel git connect --yes`.
   - "Failed to connect" / access error → Tell the user: "Install the Vercel GitHub App on your GitHub org: go to your Vercel team dashboard → Settings → Integrations → GitHub. Tell me when done." Wait for user confirmation, then retry.
   - Other errors → Show the error. Ask the user: "Want me to retry, or skip auto-deploy and continue?" If skip, set `git_connect_failed=true` (reported in Step 6 summary).

4. **Read Vercel auth token:**
   Read the Vercel CLI auth token from the local filesystem:
   - macOS: `~/Library/Application Support/com.vercel.cli/auth.json`
   - Linux: `~/.local/share/com.vercel.cli/auth.json`

   Parse JSON and extract the `token` field → `vercel_token`.
   If the file is missing or JSON parsing fails → set `vercel_token = null` (will use CLI fallback in point 5).

5. **Set environment variables via REST API:**

   Collect all env vars into a single JSON array, then send one batch request:
   ```bash
   curl -s -X POST "https://api.vercel.com/v10/projects/<name>/env?upsert=true&slug=<team>" \
     -H "Authorization: Bearer <vercel_token>" \
     -H "Content-Type: application/json" \
     -d '[{"key":"KEY","value":"VAL","type":"encrypted","target":["production","preview","development"]}, ...]'
   ```
   If personal account (no team): omit `&slug=<team>`.

   Parse the response: `created` array (success) + `failed` array (errors). Warn per failed var, continue.

   **Fallback** — if `vercel_token` is null or the API returns non-2xx: fall back to per-variable CLI:
   ```bash
   echo "<value>" | vercel env add <KEY> production --force
   ```
   CLI fallback sets production only (no preview) — preview env vars can be added manually in Vercel Dashboard.

   Variables to set (when `stack.database: supabase`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `POSTGRES_URL_NON_POOLING`

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
   - Exclude keys already handled by stack categories above (Supabase, Stripe, email, PostHog)
   - For each remaining key: read the value from `.env.local`. If found, set it on Vercel. If `.env.local` is missing or the key is absent, ask the user for the production value.

## Step 5: Deploy, configure services, and verify

### 5a: Initial deploy
1. Deploy to production:
   ```bash
   vercel --prod --yes
   ```
2. Get the deployment URL from the output.
3. If `canonical_url` is null (domain add failed or no `deploy.domain`): set `canonical_url` = the Vercel deployment URL.

### 5a.1: Surface deployment (if archetype is `cli` and surface is `detached`)

1. Verify `site/index.html` exists. If not, stop: "Surface page not found. Run `/bootstrap` to generate it."
2. Deploy the surface to Vercel:
   ```bash
   cd site && vercel --prod --yes && cd ..
   ```
3. Get the deployment URL from the output.
4. If `deploy.domain` is set in idea.yaml: add custom domain to the Vercel surface project.
5. Set `surface_url` = custom domain URL or Vercel deployment URL.
6. For CLI archetype: `canonical_url` = `surface_url` (the surface IS the canonical web presence).

### 5b: Post-deploy service configuration

Configure services using `canonical_url` (custom domain if added in Step 4.2, otherwise Vercel deployment URL). Batch all env var changes before redeploying.

1. **Supabase Auth redirect URLs and email subjects** (if `stack.auth: supabase`):
   If `stack.database` is not `supabase` (no Supabase project was created in Step 3), skip auth config — the project ref is unknown. Tell the user: "Auth redirect URLs must be configured manually in the Supabase Dashboard since no Supabase project was created during deploy."

   Read the Supabase access token. Try these locations in order:
   1. File: `~/.supabase/access-token`
   2. macOS Keychain: `security find-generic-password -s "Supabase CLI" -w 2>/dev/null` — if found, strip the `go-keyring-base64:` prefix and base64-decode the remainder
   3. If neither found, ask the user: "Supabase Management API requires an access token. Generate one at supabase.com/dashboard/account/tokens and paste it here, or type **skip** to configure auth redirect URLs manually later."
      If the user provides a token: persist it with `mkdir -p ~/.supabase && echo "$TOKEN" > ~/.supabase/access-token` (mirrors PostHog key persistence in Step 5b.3) and proceed with auth config.
      If the user types "skip": skip the auth config PATCH. Include in Step 6 summary: "Auth redirect URLs not configured — set site_url and redirect allowlist manually in Supabase Dashboard → Authentication → URL Configuration."

   Extract `<short-title>` from idea.yaml: take the `title` field up to the first ` — `, ` - `, or ` | ` delimiter. If no delimiter is found, use the full `title`. If `title` is absent, capitalize the `name` field.

   ```bash
   curl -s -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"site_url": "https://<canonical_url>", "uri_allow_list": "https://<canonical_url>/**", "mailer_subjects_confirmation": "Confirm your <short-title> account", "mailer_subjects_recovery": "Reset your <short-title> password", "mailer_subjects_magic_link": "Your <short-title> login link"}'
   ```
   If the PATCH fails, warn but continue — the user can configure this manually in Supabase Dashboard → Authentication → URL Configuration and Email Templates.

2. **Stripe webhook endpoint** (if `stack.payment: stripe` AND Stripe CLI is available):
   Check for existing endpoint: `stripe webhook_endpoints list` — if an endpoint with URL `https://<canonical_url>/api/webhooks/stripe` already exists, skip creation.
   Otherwise:
   ```bash
   stripe webhook_endpoints create \
     --url "https://<canonical_url>/api/webhooks/stripe" \
     --events checkout.session.completed
   ```
   Extract the webhook signing secret (`whsec_...`) from the output. Set it in Vercel using the REST API (Step 4.5 pattern):
   ```bash
   curl -s -X POST "https://api.vercel.com/v10/projects/<name>/env?upsert=true&slug=<team>" \
     -H "Authorization: Bearer <vercel_token>" \
     -H "Content-Type: application/json" \
     -d '[{"key":"STRIPE_WEBHOOK_SECRET","value":"<whsec_secret>","type":"encrypted","target":["production","preview","development"]}]'
   ```
   If `vercel_token` is null or the API fails, fall back to CLI: `echo "<whsec_secret>" | vercel env add STRIPE_WEBHOOK_SECRET production --force`

3. **PostHog experiment dashboard** (if `stack.analytics: posthog`):

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
   4. If skipped: include manual dashboard instructions in Step 6 summary (current fallback behavior).

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
     -d '{"name": "<idea.name> Funnel", "dashboards": [<dashboard_id>], "query": {"kind": "InsightVizNode", "source": {"kind": "FunnelsQuery", "series": [<archetype-appropriate EventsNode entries>], "funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day", "filterTestAccounts": true, "properties": {"type": "AND", "values": [{"type": "AND", "values": [{"key": "project_name", "value": ["<idea.name>"], "operator": "exact", "type": "event"}]}]}}}}'
   ```

   If idea.yaml has `variants` (web-app only): create a second funnel insight named `<idea.name> Funnel by Variant` on the same dashboard, with the same series and filters as above, plus a breakdown:
   ```bash
   curl -s -X POST "https://us.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/" \
     -H "Authorization: Bearer $POSTHOG_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name": "<idea.name> Funnel by Variant", "dashboards": [<dashboard_id>], "query": {"kind": "InsightVizNode", "source": {"kind": "FunnelsQuery", "series": [<same web-app series>], "funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day", "filterTestAccounts": true, "breakdownFilter": {"breakdown": "variant", "breakdown_type": "event"}, "properties": {"type": "AND", "values": [{"type": "AND", "values": [{"key": "project_name", "value": ["<idea.name>"], "operator": "exact", "type": "event"}]}]}}}}'
   ```
   Include `pay_start` and `pay_success` in the series if `stack.payment` is present. This lets the user compare conversion rates between variant landing pages — the core purpose of the variants feature.

   If any API call fails, include manual instructions in Step 6.

4. **External service credentials** (using CLI status from Step 0.7):

   **Auto via CLI** (ready): Read `## CLI Provisioning` from external stack file → execute provision command with canonical URL → extract credentials → set Vercel env vars. If provisioning fails: tell user "[service] CLI provisioning failed: [error]. Falling back to manual setup." Then proceed to Manual setup.

   **Manual (CLI available)** (not_installed/not_authed): Tell user: "[service] has CLI `<cli>` for auto-provisioning. Install: `<install-cmd>`. Or provide credentials manually now." Then proceed to Manual setup.

   **Manual setup** (shared path for "CLI available", "no CLI", and auto-provision failures): Read external stack file for instructions. Provide step-by-step guidance:
   - Where to create credentials (include URL)
   - Canonical URL for redirect URIs (e.g., `https://<canonical_url>/api/auth/callback/<service>`)
   - Which values to copy
   - Ask for credentials, or offer **skip** — feature returns 503 until configured via `vercel env add`
   - Set Vercel env vars

5. **Redeploy** (only if env vars were added in 5b.2 or 5b.4):
   ```bash
   vercel --prod --yes
   ```
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
| `database` | Re-extract keys: `supabase projects api-keys --project-ref <ref> -o json`. Compare with `vercel env ls`. | If mismatch: use REST API (Step 4.5 pattern) or CLI fallback to re-set each key, then redeploy |
| `auth` | Re-check Supabase auth config via Management API GET endpoint | Re-PATCH site_url and uri_allow_list |
| `analytics` | Code integration issue — cannot fix via CLI | Report: "Analytics health check failed. This is likely a code issue — merge the current PR to `main`, pull (`git checkout main && git pull`), then run `/change fix analytics integration`." |
| `payment` | Verify webhook: `stripe webhook_endpoints list`. Check env var: `vercel env ls \| grep STRIPE` | Re-set env vars if missing/wrong, redeploy |

After all fixable issues are addressed:
- If any env vars were changed → batch into a single redeploy: `vercel --prod --yes`
- Re-run health check: `curl -s <canonical_url>/api/health`

If still failing after 1 fix round → report precise per-service diagnosis with actionable next steps.

### 5e: File template observations

Follow `.claude/patterns/observe.md`. This will:
1. Process any notes in `.claude/observation-scratch.md` (captured by Rule 12
   during Steps 3–5d when working around template-rooted issues)
2. Evaluate whether any additional fixes have a template root cause

This captures deployment-specific template gaps that verify.md's build loop would
not encounter. Environmental issues (missing or mistyped env vars, temporary network
outages, uninitialized CLIs, or authentication failures) are excluded by observe.md's
trigger evaluation.

## Step 6: Summary

Print a deployment summary:

```
## Deployment Complete

**Live URL:** https://<canonical_url>
**Supabase Dashboard:** https://supabase.com/dashboard/project/<ref>
**Vercel Dashboard:** https://vercel.com/<team>/<name>

**Surface URL:** https://<surface_url>
**Health check:** [show per-service results — e.g., database: ok, auth: ok, analytics: ok, payment: ok]

**Auto-deploy:** [If git_connect_failed] Not configured — run `vercel git connect --yes` after fixing the issue above, or connect manually in Vercel Dashboard → Project Settings → Git. [Else] Active — merges to main auto-deploy to production.
**Auto-migrate:** Active — POSTGRES_URL_NON_POOLING is set, prebuild script applies migrations.

[If domain add succeeded] **Custom domain:** https://<name>.<domain>
[If domain add failed] **Custom domain (manual):** Run `vercel domains add <name>.<domain>` after verifying wildcard DNS (CNAME `*` → `cname.vercel-dns.com`, DNS Only).

[If auth] **Auth redirect URLs:** Configured — site_url set to https://<canonical_url>
[If auth] **Email subjects:** Configured — confirmation, recovery, and magic link emails use app name
[If payment AND Stripe CLI was available] **Stripe webhook:** Configured — endpoint https://<canonical_url>/api/webhooks/stripe, events: checkout.session.completed
[If payment AND Stripe CLI was NOT available] **Stripe webhook (manual):** Add the webhook URL in Stripe Dashboard → Developers → Webhooks:
  Endpoint URL: https://<canonical_url>/api/webhooks/stripe
  Events: checkout.session.completed
[If any health check failed] **Action needed:** [list failing services with fix commands]

[If external services] **External services:**
- [service]: ✅ auto-provisioned via CLI / ✅ manually configured / ❌ not configured — `vercel env add <KEY> production`
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
  "supabase": {
    "ref": "<ref>",
    "org_id": "<org-id>"
  },
  "vercel": {
    "project": "<name>",
    "team": "<team>",
    "domain": "<domain or null>"
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

Omit sections for inactive stack categories (e.g., no `supabase` key if `stack.database` is absent). This manifest is consumed by `/teardown` to identify what to delete.

If the write fails, warn but continue — the manifest is for convenience, not correctness.

## Idempotency

This skill handles re-runs gracefully:
- `vercel link` reuses existing projects
- `upsert=true` on the env var REST API overwrites existing values; CLI fallback uses `--force`
- `supabase db push` skips already-applied migrations
- Checks for existing Supabase projects before creating
- Supabase auth config PATCH is idempotent — overwrites existing values
- Stripe webhook creation checks for existing endpoint before creating
- Stripe CLI is a soft dependency — falls back to manual setup if not installed
- `vercel domains add` is idempotent — adding an already-configured domain is a no-op
- Re-running `/deploy` overwrites `.claude/deploy-manifest.json` with current resource state

## Do NOT

- Create a git branch or PR — this is infrastructure-only
- Modify any source code files
- Store secrets in code or commit them
- Skip the approval step — the user must review the plan before resources are created
- Proceed if CLI auth checks fail — always stop and tell the user which login command to run
