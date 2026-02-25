---
description: "Deploy the app to Vercel + Supabase. Run once after /bootstrap PR is merged."
type: analysis-only
reads:
  - idea/idea.yaml
  - .env.example
  - CLAUDE.md
stack_categories: [hosting, database, auth, analytics, payment]
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
5. Verify `stack.hosting` is `vercel`. If not, stop: "Only Vercel hosting is supported by /deploy. Deploy manually for other hosting providers."
6. Check CLI installation and auth (check install first, then auth — they are different failures with different fixes):
   - `which vercel` — if not found, stop: "Vercel CLI not installed. Install: `npm i -g vercel`"
   - `vercel whoami` — if fails, stop: "Run `vercel login` first (one-time per machine)."
   - If `stack.database: supabase`: `which supabase` — if not found, stop: "Supabase CLI not installed. Install: `brew install supabase/tap/supabase` (macOS/Linux) or see https://supabase.com/docs/guides/cli/getting-started"
   - If `stack.database: supabase`: `supabase projects list` — if fails, stop: "Run `supabase login` first (one-time per machine)."
   - If `stack.payment: stripe`: `which stripe` — if not found, warn: "Stripe CLI not installed. Webhook will need manual setup. Install: `brew install stripe/stripe-cli/stripe` (macOS) or see https://stripe.com/docs/stripe-cli." If found: `stripe whoami` — if fails, stop: "Run `stripe login` first (one-time per machine)."

## Step 1: Gather configuration

1. **Vercel team**: Read `deploy.vercel_team` from idea.yaml. If not set, run `vercel teams list` and ask the user to pick one (or use personal account).
2. **Supabase org** (if `stack.database: supabase`): Read `deploy.supabase_org` from idea.yaml. If not set, run `supabase orgs list -o json` and ask the user to pick one.
3. **Supabase region**: Read `deploy.supabase_region` from idea.yaml, or default to `us-east-1`.
4. **DB password**: Generate with `openssl rand -base64 24`.
5. **Stripe keys** (if `stack.payment` is present): Ask the user for `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. If Stripe CLI is available, the webhook secret will be auto-generated in Step 5. If not, also ask for `STRIPE_WEBHOOK_SECRET`.

## Step 2: Present deployment plan — STOP for approval

Present a summary of what will be created:

```
## Deployment Plan

**Vercel project:** <name> (team: <team>)
**Supabase project:** <name> (org: <org>, region: <region>)
**Environment variables:** <list of env vars to be set>
**Migrations:** <N files in supabase/migrations/ will be applied>

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
   - `POSTGRES_URL_NON_POOLING`: query the pooler config to get the correct hostname:
     ```bash
     curl -s "https://api.supabase.com/v1/projects/<ref>/config/database/pooler" \
       -H "Authorization: Bearer <token>"
     ```
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

2. Connect GitHub repo for auto-deploy:
   ```bash
   vercel git connect --yes
   ```
   If this fails, **pause and help the user fix it** — do not skip auto-deploy silently. Diagnose the error:
   - "Login Connection" error → Tell the user: "Go to https://vercel.com/account/settings/authentication → Connect GitHub. Tell me when done." Wait for user confirmation, then retry `vercel git connect --yes`.
   - "Failed to connect" / access error → Tell the user: "Install the Vercel GitHub App on your GitHub org: go to your Vercel team dashboard → Settings → Integrations → GitHub. Tell me when done." Wait for user confirmation, then retry.
   - Other errors → Show the error. Ask the user: "Want me to retry, or skip auto-deploy and continue?" If skip, set `git_connect_failed=true` (reported in Step 6 summary).

3. Set environment variables for both `production` and `preview`:
   ```bash
   echo "<value>" | vercel env add <KEY> production --force
   echo "<value>" | vercel env add <KEY> preview --force
   ```

   Variables to set (when `stack.database: supabase`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `POSTGRES_URL_NON_POOLING`

   Additional variables (when `stack.payment: stripe`):
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET` (skip if Stripe CLI is available — set after webhook creation in Step 5)

## Step 5: Deploy, configure services, and verify

### 5a: Initial deploy
1. Deploy to production:
   ```bash
   vercel --prod --yes
   ```
2. Get the deployment URL from the output.

### 5b: Post-deploy service configuration

Configure services that require the deployment URL. Batch all env var changes before redeploying.

1. **Supabase Auth redirect URLs and email subjects** (if `stack.auth: supabase`):
   Read the Supabase access token. Try these locations in order:
   1. File: `~/.supabase/access-token`
   2. macOS Keychain: `security find-generic-password -s "Supabase CLI" -w 2>/dev/null` — if found, strip the `go-keyring-base64:` prefix and base64-decode the remainder
   3. If neither found, ask the user: "Supabase Management API requires an access token. Generate one at supabase.com/dashboard/account/tokens and paste it here."

   Extract `<short-title>` from idea.yaml: take the `title` field up to the first ` — `, ` - `, or ` | ` delimiter. If no delimiter is found, use the full `title`. If `title` is absent, capitalize the `name` field.

   ```bash
   curl -s -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"site_url": "https://<url>", "uri_allow_list": "https://<url>/**", "mailer_subjects_confirmation": "Confirm your <short-title> account", "mailer_subjects_recovery": "Reset your <short-title> password", "mailer_subjects_magic_link": "Your <short-title> login link"}'
   ```
   If the PATCH fails, warn but continue — the user can configure this manually in Supabase Dashboard → Authentication → URL Configuration and Email Templates.

2. **Stripe webhook endpoint** (if `stack.payment: stripe` AND Stripe CLI is available):
   Check for existing endpoint: `stripe webhook_endpoints list` — if an endpoint with URL `https://<url>/api/webhooks/stripe` already exists, skip creation.
   Otherwise:
   ```bash
   stripe webhook_endpoints create \
     --url "https://<url>/api/webhooks/stripe" \
     --events checkout.session.completed
   ```
   Extract the webhook signing secret (`whsec_...`) from the output. Set it in Vercel:
   ```bash
   echo "<whsec_secret>" | vercel env add STRIPE_WEBHOOK_SECRET production --force
   echo "<whsec_secret>" | vercel env add STRIPE_WEBHOOK_SECRET preview --force
   ```

3. **Redeploy** (only if env vars were added in 5b.2):
   ```bash
   vercel --prod --yes
   ```
   Note: projects with Stripe require two production deploys during first-time setup (one to get the URL, one after webhook secret is configured). Subsequent deploys via git push need only one.

### 5c: Health check

```bash
curl -s <url>/api/health
```
Parse the JSON response. Each service returns `"ok"` or an error message.

If all checks pass → proceed to Step 6.

### 5d: Auto-fix (max 1 round)

If any health check fails, diagnose and attempt to fix:

| Check | Diagnosis | Auto-fix |
|-------|-----------|----------|
| `database` | Re-extract keys: `supabase projects api-keys --project-ref <ref> -o json`. Compare with `vercel env ls`. | If mismatch: `vercel env add <KEY> production --force` for each, then redeploy |
| `auth` | Re-check Supabase auth config via Management API GET endpoint | Re-PATCH site_url and uri_allow_list |
| `analytics` | Code integration issue — cannot fix via CLI | Report: "Analytics health check failed. This is likely a code issue — merge the current PR to `main`, pull (`git checkout main && git pull`), then run `/change fix analytics integration`." |
| `payment` | Verify webhook: `stripe webhook_endpoints list`. Check env var: `vercel env ls \| grep STRIPE` | Re-set env vars if missing/wrong, redeploy |

After all fixable issues are addressed:
- If any env vars were changed → batch into a single redeploy: `vercel --prod --yes`
- Re-run health check: `curl -s <url>/api/health`

If still failing after 1 fix round → report precise per-service diagnosis with actionable next steps.

### 5e: File template observations

If any fix during the deploy flow (Steps 3–5d) required working around a problem whose
root cause is in a template file (stack file, command file, or pattern file), follow
`.claude/patterns/observe.md` to file an observation issue. This captures
deployment-specific template gaps that verify.md's build loop would not encounter. Do
NOT file observations for environmental issues (missing or mistyped env vars, temporary
network outages, uninitialized CLIs, or authentication failures) — observe.md's trigger
evaluation excludes these.

## Step 6: Summary

Print a deployment summary:

```
## Deployment Complete

**Live URL:** https://<deployment-url>
**Supabase Dashboard:** https://supabase.com/dashboard/project/<ref>
**Vercel Dashboard:** https://vercel.com/<team>/<name>

**Health check:** [show per-service results — e.g., database: ok, auth: ok, analytics: ok, payment: ok]

**Auto-deploy:** [If git_connect_failed] Not configured — run `vercel git connect --yes` after fixing the issue above, or connect manually in Vercel Dashboard → Project Settings → Git. [Else] Active — merges to main auto-deploy to production.
**Auto-migrate:** Active — POSTGRES_URL_NON_POOLING is set, prebuild script applies migrations.

[If auth] **Auth redirect URLs:** Configured — site_url set to https://<deployment-url>
[If auth] **Email subjects:** Configured — confirmation, recovery, and magic link emails use app name
[If payment AND Stripe CLI was available] **Stripe webhook:** Configured — endpoint https://<deployment-url>/api/webhooks/stripe, events: checkout.session.completed
[If payment AND Stripe CLI was NOT available] **Stripe webhook (manual):** Add the webhook URL in Stripe Dashboard → Developers → Webhooks:
  Endpoint URL: https://<deployment-url>/api/webhooks/stripe
  Events: checkout.session.completed
[If any health check failed] **Action needed:** [list failing services with fix commands]

**Next steps** (all optional — pick what fits your distribution plan):
1. Share the live URL with target users and gather initial feedback
2. Run `/distribute` to generate Google Ads config (only if using paid ads)
3. After collecting data, run `/iterate` to analyze metrics and decide what to change
```

## Idempotency

This skill handles re-runs gracefully:
- `vercel link` reuses existing projects
- `--force` flag on `vercel env add` overwrites existing values
- `supabase db push` skips already-applied migrations
- Checks for existing Supabase projects before creating
- Supabase auth config PATCH is idempotent — overwrites existing values
- Stripe webhook creation checks for existing endpoint before creating
- Stripe CLI is a soft dependency — falls back to manual setup if not installed

## Do NOT

- Create a git branch or PR — this is infrastructure-only
- Modify any source code files
- Store secrets in code or commit them
- Skip the approval step — the user must review the plan before resources are created
- Proceed if CLI auth checks fail — always stop and tell the user which login command to run
