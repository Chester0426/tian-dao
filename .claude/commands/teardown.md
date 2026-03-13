---
description: "Tear down cloud infrastructure created by /deploy. Use when ending an experiment."
type: analysis-only
reads:
  - experiment/experiment.yaml
  - .claude/deploy-manifest.json
  - CLAUDE.md
stack_categories: [hosting, database, analytics, payment]
requires_approval: true
references: []
branch_prefix: ""
modifies_specs: false
---
Tear down the cloud infrastructure created by `/deploy`.

This skill is hosting-agnostic: it reads `hosting.provider` and `database.provider` from the deploy manifest, loads the corresponding stack files, and executes teardown commands from their `## Deploy Interface > Teardown` sections.

## Step 0: Validate preconditions

1. Read `.claude/deploy-manifest.json`. If missing, stop: "No deploy manifest found.
   Run `/deploy` first, or delete resources manually via each provider's dashboard."
2. Read `experiment/experiment.yaml` — extract `name` for confirmation prompt.
3. Read `hosting.provider` and `database.provider` from the manifest. Load the corresponding
   stack files at `.claude/stacks/hosting/<provider>.md` and `.claude/stacks/database/<provider>.md`.
4. Check CLI installation and auth — read each stack file's `## Deploy Interface > Prerequisites`
   and run the checks (only for services present in the manifest):
   - If `hosting` in manifest: run hosting stack file's `install_check` + `auth_check`
   - If `database` in manifest: run database stack file's `install_check` + `auth_check` (skip if no Prerequisites section)
   - If `posthog` in manifest: check `~/.posthog/personal-api-key` exists
   - If `stripe` in manifest: `which stripe` + `stripe whoami` (soft — webhook
     deletion is nice-to-have)

## Step 1: Present teardown plan — STOP for approval

Present a summary:

```
## Teardown Plan

**Project:** <name>

**Resources to delete (in reverse order of creation):**
1. [If posthog] PostHog dashboard: #<dashboard_id>
2. [If stripe] Stripe webhook endpoint: <url>
3. [If hosting.domain] Custom domain: <domain>
4. [If hosting] Hosting project (<provider>): <project> — unlinks integrations
5. [If database] Database project (<provider>): <ref/id> — permanent data loss
6. [If external_services] External services (manual): <list>

This action is irreversible. All data in the database will be permanently deleted.

To confirm, type the project name: **<name>**
```

Do not proceed until the user types the exact project name.

## Step 2: Pre-delete safety check (if database present)

If `database` is in the manifest and the database stack file has a `## Deploy Interface > Teardown` section with a pre-delete safety check:

Follow the stack file's Teardown instructions for the safety check (e.g., query row counts). If any table has rows > 0, warn:

```
Database contains live data:
- <table>: <N> rows
- <table>: <N> rows

Type **delete** to confirm permanent data deletion, or **cancel** to abort.
```

If the user types "cancel", stop.

## Step 3: Delete resources (reverse order of /deploy creation)

Delete in reverse order of creation. Each step is independent — continue on failure.

### 3a: Analytics dashboard (if present in manifest)

Read `~/.posthog/personal-api-key`. If available, first discover the project ID:
```bash
POSTHOG_PROJECT_ID=$(curl -s "https://us.i.posthog.com/api/projects/" \
  -H "Authorization: Bearer <api_key>" | python3 -c "import sys,json; print(json.load(sys.stdin)['results'][0]['id'])")
```
Then delete the dashboard:
```bash
curl -s -X DELETE "https://us.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/dashboards/<dashboard_id>/" \
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

### 3c: Custom domain (if present in manifest)

Read the hosting stack file's `## Deploy Interface > Teardown`. Execute the remove-domain command with the domain from the manifest.

If fails: report and continue.

### 3d: Hosting project

Read the hosting stack file's `## Deploy Interface > Teardown`. Execute the remove-project command.

If fails: report with the dashboard URL from the stack file's Teardown section for manual fallback.

### 3e: Database project (if present in manifest)

Read the database stack file's `## Deploy Interface > Teardown`. Execute the delete command.

If fails: report with the dashboard URL from the stack file's Teardown section for manual fallback.

### 3f: External services (manual)

For each service in `external_services`:
- Read `.claude/stacks/external/<service-slug>.md` for the dashboard URL
- List the service with its dashboard URL for manual cleanup

### 3g: Provision scan (verify deletion)

Spawn the `provision-scanner` agent (`subagent_type: provision-scanner`).
Pass context:

> Mode: teardown
> Manifest path: .claude/deploy-manifest.json

Note: the manifest still exists at this point (Step 4 deletes it). The scanner reads it to know what to verify as deleted.

Wait for the agent to complete. Include the scanner's output table in the Step 5 summary under a **Deletion Verification** heading. If any check FAILs (resource still exists), list the resource with its manual-deletion dashboard URL from the relevant stack file's Teardown section.

## Step 4: Cleanup

1. Delete `.claude/deploy-manifest.json`
2. Remove `.env.local` if it exists (contains deployed credentials that are now invalid).
   Ask user first: "`.env.local` contains credentials for the deleted infrastructure.
   Delete it? (y/n)"

## Step 5: Summary

```
## Teardown Complete

**Deleted:**
- [For each successfully deleted resource] <provider> <resource type> <id>
- PostHog dashboard #<id>

**Failed (manual cleanup needed):**
- <resource> — <dashboard URL from stack file's Teardown section>

**External services (manual cleanup):**
- <service> — <dashboard URL>

**Local cleanup:**
- .claude/deploy-manifest.json deleted
- [.env.local deleted / .env.local kept]

**What's preserved:**
- All source code on main branch
- experiment.yaml, EVENTS.yaml (experiment definition)
- Migration files (can re-deploy with /deploy)

To re-deploy this experiment: run `/deploy` again.
To archive this experiment: `gh release create v1.0 --notes "Experiment <name> concluded"`
```

## Do NOT

- Delete source code, experiment.yaml, or git history
- Delete without user confirmation (name + data check)
- Block on partial failures — report and continue
- Delete .env.example (that's a template, not credentials)
