---
assumes: [framework/nextjs]
packages:
  runtime: []
  dev: []
files:
  - src/app/api/health/route.ts
env:
  server: []
  client: []
ci_placeholders: {}
clean:
  files: []
  dirs: []
gitignore: [.vercel/]
---
# Hosting: Vercel
> Used when idea.yaml has `stack.hosting: vercel`
> Assumes: `framework/nextjs` (references `NEXT_PUBLIC_` env var prefix convention)

## Deployment
```bash
npx vercel deploy --prod
```

## Auto-Deploy on Merge
- Vercel's GitHub integration auto-deploys to production on every push/merge to `main`
- Preview deployments are created automatically on PRs (used by `preview-smoke` CI job)
- `make deploy` remains available for manual CLI deploys and first-time project linking
- Skills should not include `make deploy` as a required iteration step — merging to `main` is sufficient

## Health Check

### `src/app/api/health/route.ts` — Deployment health endpoint

Bootstrap creates this endpoint unconditionally. It always returns basic status; service-specific checks are added based on the active stack.

**Base template (always created):**
```ts
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };
  // Service checks are added by bootstrap based on active stack services.
  // Each returns "ok" or an error message.
  return NextResponse.json(checks);
}
```

**When `stack.database` is present:** bootstrap adds a database connectivity check inside the function body — import the server client, run a lightweight query (e.g., `supabase.from('...').select('id').limit(1)`), and set `checks.database = "ok"` or the error message.

**When `stack.auth` is present:** bootstrap adds an auth service check — call `supabase.auth.getUser()` with no session (expects an auth error, not a network error), and set `checks.auth = "ok"` or the error message.

**When `stack.analytics` is present:** bootstrap adds an analytics reachability check — fetch the analytics provider's lightweight API endpoint from the server to verify the service is reachable and the integration code loads without errors. For PostHog: `fetch(POSTHOG_HOST + "/decide?v=3", { method: "POST", body: JSON.stringify({ api_key: POSTHOG_KEY, distinct_id: "healthcheck" }) })`. Import constants from the analytics server library. Set `checks.analytics = "ok"` or the error message. The `/decide` endpoint is lightweight and does not create events.

**When `stack.payment` is present:** bootstrap adds a payment configuration check — verify the payment provider's secret key env var exists and has the correct format. For Stripe: check `process.env.STRIPE_SECRET_KEY` starts with `sk_`. Set `checks.payment = "ok"` or the error message.

**Response:** Returns 200 with JSON `{ status: "ok", ... }` if all checks pass. Returns 503 if any check fails, with individual check results so failures are diagnosable.

## Preview Smoke Test

Vercel automatically creates preview deployments on PRs. CI runs page-load smoke tests against the preview URL before merge.

- No auth, no database writes, no Docker required
- Reuses existing `e2e/smoke.spec.ts` via `E2E_BASE_URL` pointed at the preview URL
- PR-only (`github.event_name == 'pull_request'`) — pushes to main don't create preview deployments
- Uses `patrickedqvist/wait-for-vercel-preview` GitHub Action to get the preview URL

See the testing stack file's "Preview Smoke CI Job Template" section for the CI job template.

## Environment Variables
- **Supabase env vars:** Use the [Supabase Vercel Integration](https://vercel.com/integrations/supabase) to auto-inject database env vars (see Supabase Vercel Integration section below)
- **Other env vars (Stripe, etc.):** Set manually via Vercel dashboard → Project → Settings → Environment Variables
- Client-side env vars must use `NEXT_PUBLIC_` prefix
- Never commit secrets to code — always use environment variables

## Supabase Vercel Integration
When `stack.database: supabase` is present, the recommended production setup is the [Supabase Vercel Integration](https://vercel.com/integrations/supabase):
- Auto-creates or links a Supabase project to the Vercel project
- Auto-injects environment variables into Vercel, including:
  - `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` (connection strings)
  - `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_DATABASE`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Database migrations are auto-applied during build via the `prebuild` script (see database stack file "Auto-Migration on Vercel Build")
- Eliminates manual env var copying and manual migration for non-technical team members

Bootstrap PR instructions should reference this integration as the primary setup method, with manual env var entry as a fallback.

## CLI Deployment (Non-Interactive)

Used by the `/deploy` skill for automated first-time setup.

### Project Setup
- `vercel link --yes --project <name> [--scope "<team>"]` — creates project if not exists, links locally
- `vercel git connect --yes` — connects GitHub repo for push-to-main auto-deploy
  - Prerequisite: Vercel GitHub App installed on the GitHub org/account

### Environment Variables

**Primary method — Vercel REST API (batch, all environments):**
```bash
curl -s -X POST "https://api.vercel.com/v10/projects/<name>/env?upsert=true&slug=<team>" \
  -H "Authorization: Bearer <vercel_token>" \
  -H "Content-Type: application/json" \
  -d '[{"key":"KEY","value":"VAL","type":"encrypted","target":["production","preview","development"]}]'
```
- `upsert=true` overwrites existing values (idempotent)
- Sets all environments (production, preview, development) in one call
- Omit `&slug=<team>` for personal accounts

**Auth token location:**
- macOS: `~/Library/Application Support/com.vercel.cli/auth.json` → parse JSON, extract `token`
- Linux: `~/.local/share/com.vercel.cli/auth.json` → parse JSON, extract `token`

**Fallback — Vercel CLI (production only, per-variable):**
- `echo $VALUE | vercel env add KEY production --force` — set/overwrite an env var
- Used when auth token is unavailable or REST API fails

**Verify:** `vercel env ls` — list env vars after setup

### First Deploy
- `vercel --prod --yes` — deploy to production without prompts

## Rate Limiting Limitation
Simple in-memory counters do not persist across serverless invocations on Vercel, so they are not effective for rate limiting.

For auth and payment API routes:
- Add `// TODO: Add production rate limiting (e.g., Upstash Redis)` comment at the top of the route handler
- If idea.yaml `stack` includes a rate-limiting service (e.g., Upstash), use that instead
- Mention this limitation in the PR body so the user knows to address it before production

## Patterns
- Vercel auto-deploys to production when PRs are merged to `main` (requires GitHub integration)
- Deploy with `npx vercel deploy --prod` for manual production deployments
- After manual `make deploy`, the health endpoint is automatically checked
- Use Vercel's preview deployments (automatic on PRs) for testing before production
- Preview deployments are smoke-tested in CI before merge
- Client-side environment variables must use the `NEXT_PUBLIC_` prefix
- Environment variables are configured per-environment (Production, Preview, Development) in the Vercel dashboard

## PR Instructions
- After merging: run `/deploy` in Claude Code to set up Vercel + Supabase automatically. Or manually: import your repo at [vercel.com/new](https://vercel.com/new) and add the Supabase Vercel Integration ([vercel.com/integrations/supabase](https://vercel.com/integrations/supabase)) to auto-inject Supabase env vars. For other env vars (Stripe, etc.), add them manually in Vercel Project → Settings → Environment Variables.
- Vercel auto-deploys on every merge to `main`

## Deploy Interface

Standardized subsections referenced by deploy.md and teardown.md. Each subsection is a self-contained recipe — deploy.md reads them by name and executes the instructions.

### Prerequisites

- **install_check:** `which vercel`
- **install_fix:** `npm i -g vercel`
- **auth_check:** `vercel whoami`
- **auth_fix:** `vercel login`

### Config Gathering

- **CLI command:** `vercel teams list` — lists available teams (or personal account)
- **idea.yaml field:** `deploy.vercel_team` — if set, skip the prompt

### Project Setup

1. Link or create the project (idempotent):
   ```bash
   vercel link --yes --project <name> [--scope "<team>"]
   ```
2. Connect GitHub repo for auto-deploy:
   ```bash
   vercel git connect --yes
   ```
   Prerequisite: Vercel GitHub App installed on the GitHub org/account.
   - "Login Connection" error → user needs to connect GitHub at https://vercel.com/account/settings/authentication
   - "Failed to connect" → user needs to install Vercel GitHub App on their org

### Domain Setup

1. Construct domain: `<name>.<domain>` (default parent domain: `draftlabs.org`; override with `deploy.domain` in idea.yaml)
2. Add domain:
   ```bash
   vercel domains add <name>.<domain> --scope "<team>"
   ```
3. **On success:** `canonical_url` = `<name>.<domain>`, `domain_added` = true
4. **On failure:** Warn "Could not add custom domain. Verify wildcard DNS (CNAME `*` → `cname.vercel-dns.com`, DNS Only)." Set `canonical_url` = null (finalized after deploy), `domain_added` = false

### Environment Variables

**Primary method — REST API (batch, all environments):**
```bash
curl -s -X POST "https://api.vercel.com/v10/projects/<name>/env?upsert=true&slug=<team>" \
  -H "Authorization: Bearer <vercel_token>" \
  -H "Content-Type: application/json" \
  -d '[{"key":"KEY","value":"VAL","type":"encrypted","target":["production","preview","development"]}]'
```
- `upsert=true` overwrites existing values (idempotent)
- Omit `&slug=<team>` for personal accounts

**Auth token location:**
- macOS: `~/Library/Application Support/com.vercel.cli/auth.json` → parse JSON, extract `token`
- Linux: `~/.local/share/com.vercel.cli/auth.json` → parse JSON, extract `token`
- If missing or parse fails → set `vercel_token = null` (use fallback)

**Fallback — CLI (production only, per-variable):**
```bash
echo $VALUE | vercel env add KEY production --force
```

**Verify:** `vercel env ls`

### Deploy

- **Command:** `vercel --prod --yes`
- **Extract URL:** from command output

### Health Check

```bash
curl -s <canonical_url>/api/health
```
Returns JSON `{ status: "ok", ... }` with per-service checks.

### Auto-Fix

| Check | Diagnosis | Fix |
|-------|-----------|-----|
| Env vars | `vercel env ls` — compare with expected | Re-set via REST API or CLI fallback, then redeploy |
| Redeploy | — | `vercel --prod --yes` |

### Teardown

1. Remove custom domain:
   ```bash
   vercel domains rm <domain> --scope "<team>" --yes
   ```
2. Remove project:
   ```bash
   vercel project rm <project> --scope "<team>" --yes
   ```
3. **Dashboard URL (manual fallback):** `https://vercel.com/<team>/<project>/settings`

### Manifest Keys

```json
{
  "provider": "vercel",
  "project": "<name>",
  "team": "<team>",
  "domain": "<domain or null>"
}
```

### Rollback

- **Command:** `vercel rollback`
- **Dashboard:** Vercel → Deployments → "..." → "Promote to Production"
- **Note:** Instant — no rebuild. Does NOT rollback database migrations.

### Compatibility

- **incompatible_databases:** `[sqlite]`
- **reason:** Serverless functions have no persistent filesystem — SQLite database files are lost between invocations
