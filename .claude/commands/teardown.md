---
description: "Tear down cloud infrastructure created by /deploy. Use when ending an experiment."
type: analysis-only
reads:
  - idea/idea.yaml
  - .claude/deploy-manifest.json
  - CLAUDE.md
stack_categories: [hosting, database, analytics, payment]
requires_approval: true
references: []
branch_prefix: ""
modifies_specs: false
---
Tear down the cloud infrastructure created by `/deploy`.

## Step 0: Validate preconditions

1. Read `.claude/deploy-manifest.json`. If missing, stop: "No deploy manifest found.
   Run `/deploy` first, or delete resources manually via each provider's dashboard."
2. Read `idea/idea.yaml` — extract `name` for confirmation prompt.
3. Check CLI installation and auth (same checks as /deploy Step 0.6, but only for
   services present in the manifest):
   - If `supabase` in manifest: `which supabase` + `supabase projects list`
   - `which vercel` + `vercel whoami`
   - If `posthog` in manifest: check `~/.posthog/personal-api-key` exists
   - If `stripe` in manifest: `which stripe` + `stripe whoami` (soft — webhook
     deletion is nice-to-have)

## Step 1: Present teardown plan — STOP for approval

Present a summary:

```
## Teardown Plan

**Project:** <name>

**Resources to delete:**
- [If supabase] Supabase project: <ref> (org: <org_id>)
- Vercel project: <project> (team: <team>)
- [If domain] Vercel domain: <domain>
- [If posthog] PostHog dashboard: #<dashboard_id>
- [If stripe] Stripe webhook endpoint: <url>
- [If external_services] External services (manual): <list>

⚠️  This action is irreversible. All data in the Supabase database will be
permanently deleted.

To confirm, type the project name: **<name>**
```

Do not proceed until the user types the exact project name.

## Step 2: Pre-delete safety check (if Supabase present)

If `supabase` is in the manifest:

1. Read the Supabase access token (same procedure as /deploy Step 5b.1).
2. Query for user-facing table row counts:
   ```bash
   curl -s "https://<ref>.supabase.co/rest/v1/<table>?select=count" \
     -H "Authorization: Bearer <service_role_key>" \
     -H "apikey: <anon_key>" \
     -H "Prefer: count=exact"
   ```
   Check tables from `supabase/migrations/` (parse CREATE TABLE statements).
3. If any table has rows > 0, warn:

   ```
   ⚠️  Database contains live data:
   - <table>: <N> rows
   - <table>: <N> rows

   Type **delete** to confirm permanent data deletion, or **cancel** to abort.
   ```

   If the user types "cancel", stop.

## Step 3: Delete resources (reverse order of /deploy creation)

Delete in reverse order of creation. Each step is independent — continue on failure.

### 3a: Analytics dashboard (if present in manifest)

Read `~/.posthog/personal-api-key`. If available:
```bash
curl -s -X DELETE "https://us.i.posthog.com/api/projects/321343/dashboards/<dashboard_id>/" \
  -H "Authorization: Bearer <api_key>"
```
If key not available or API fails: report "PostHog dashboard #<id> — delete manually
at https://us.posthog.com/dashboard/<id>"

### 3b: Stripe webhook endpoint (if present in manifest)

If Stripe CLI is available:
```bash
stripe webhook_endpoints list --url <webhook_url>
```
Then delete using the endpoint ID:
```bash
stripe webhook_endpoints delete <endpoint_id>
```
Note: manifest stores the URL, not the endpoint ID. List endpoints to find the ID.

If CLI not available or fails: report "Stripe webhook — delete manually at
https://dashboard.stripe.com/webhooks"

### 3c: Vercel domain (if present in manifest)

```bash
vercel domains rm <domain> --scope "<team>" --yes
```
If fails: report and continue.

### 3d: Vercel project

```bash
vercel project rm <project> --scope "<team>" --yes
```
If fails: report "Vercel project — delete manually at https://vercel.com/<team>/<project>/settings"

### 3e: Supabase project (if present in manifest)

```bash
supabase projects delete --project-ref <ref>
```
The CLI will prompt for confirmation — this is expected.

If fails: report "Supabase project — delete manually at https://supabase.com/dashboard/project/<ref>/settings/general"

### 3f: External services (manual)

For each service in `external_services`:
- Read `.claude/stacks/external/<service-slug>.md` for the dashboard URL
- List the service with its dashboard URL for manual cleanup

## Step 4: Cleanup

1. Delete `.claude/deploy-manifest.json`
2. Remove `.env.local` if it exists (contains deployed credentials that are now invalid).
   Ask user first: "`.env.local` contains credentials for the deleted infrastructure.
   Delete it? (y/n)"

## Step 5: Summary

```
## Teardown Complete

**Deleted:**
- ✅ Supabase project <ref>
- ✅ Vercel project <project>
- ✅ Vercel domain <domain>
- ✅ PostHog dashboard #<id>

**Failed (manual cleanup needed):**
- ❌ <resource> — <dashboard URL>

**External services (manual cleanup):**
- <service> — <dashboard URL>

**Local cleanup:**
- ✅ .claude/deploy-manifest.json deleted
- [✅ .env.local deleted / ⏭️ .env.local kept]

**What's preserved:**
- All source code on main branch
- idea.yaml, EVENTS.yaml (experiment definition)
- supabase/migrations/ (can re-deploy with /deploy)

To re-deploy this experiment: run `/deploy` again.
```

## Do NOT

- Delete source code, idea.yaml, or git history
- Delete without user confirmation (name + data check)
- Block on partial failures — report and continue
- Delete .env.example (that's a template, not credentials)
