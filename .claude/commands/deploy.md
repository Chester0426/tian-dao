---
description: "Deploy the app to Vercel + Supabase. Run once after /bootstrap PR is merged."
type: analysis-only
reads:
  - idea/idea.yaml
  - .env.example
  - CLAUDE.md
stack_categories: [hosting, database, payment]
requires_approval: true
references: []
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
6. Check CLI auth:
   - `vercel whoami` — if fails, stop: "Run `vercel login` first (one-time per machine)."
   - If `stack.database: supabase`: `supabase projects list` — if fails, stop: "Run `npx supabase login` first (one-time per machine)."

## Step 1: Gather configuration

1. **Vercel team**: Read `deploy.vercel_team` from idea.yaml. If not set, run `vercel teams list` and ask the user to pick one (or use personal account).
2. **Supabase org** (if `stack.database: supabase`): Read `deploy.supabase_org` from idea.yaml. If not set, run `supabase orgs list -o json` and ask the user to pick one.
3. **Supabase region**: Read `deploy.supabase_region` from idea.yaml, or default to `us-east-1`.
4. **DB password**: Generate with `openssl rand -base64 24`.
5. **Stripe keys** (if `stack.payment` is present): Ask the user for `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`.

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
   - `POSTGRES_URL_NON_POOLING` = `postgresql://postgres.<ref>:<password>@db.<ref>.supabase.com:5432/postgres`
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
   If this fails (e.g., Vercel GitHub App not installed), warn the user but continue — they can connect later from the Vercel dashboard.

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
   - `STRIPE_WEBHOOK_SECRET`

## Step 5: Deploy and verify

1. Deploy to production:
   ```bash
   vercel --prod --yes
   ```
2. Get the deployment URL from the output.
3. Verify the health endpoint:
   ```bash
   curl -sf <url>/api/health
   ```
4. Report the result — success or failure with diagnostics.

## Step 6: Summary

Print a deployment summary:

```
## Deployment Complete

**Live URL:** https://<deployment-url>
**Supabase Dashboard:** https://supabase.com/dashboard/project/<ref>
**Vercel Dashboard:** https://vercel.com/<team>/<name>

**Auto-deploy:** Active — merges to main auto-deploy to production.
**Auto-migrate:** Active — POSTGRES_URL_NON_POOLING is set, prebuild script applies migrations.

[If payment] **Next step:** Add the Stripe webhook URL in Stripe Dashboard → Developers → Webhooks:
  Endpoint URL: https://<deployment-url>/api/webhooks/stripe
  Events: checkout.session.completed
```

## Idempotency

This skill handles re-runs gracefully:
- `vercel link` reuses existing projects
- `--force` flag on `vercel env add` overwrites existing values
- `supabase db push` skips already-applied migrations
- Checks for existing Supabase projects before creating

## Do NOT

- Create a git branch or PR — this is infrastructure-only
- Modify any source code files
- Store secrets in code or commit them
- Skip the approval step — the user must review the plan before resources are created
- Proceed if CLI auth checks fail — always stop and tell the user which login command to run
