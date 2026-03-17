---
description: "Roll back to the previous production deployment. Emergency use — no branch or PR."
type: analysis-only
requires_approval: true
branch_prefix: ""
reads:
  - .claude/deploy-manifest.json
  - experiment/experiment.yaml
stack_categories:
  - hosting
references:
  - .claude/patterns/incident-response.md
modifies_specs: false
---

# /rollback

Roll back to the previous production deployment when something goes wrong after deploy.

> **Emergency skill** — no branch, no PR. Acts directly on production.

## Step 1: Read deploy manifest

Read `.claude/deploy-manifest.json` and extract:
- `hosting.provider` — the hosting provider
- `canonical_url` — the production URL

If the file is missing or `hosting` is absent, STOP: "No deploy manifest found. Has this project been deployed with `/deploy`?"

## Step 2: Read hosting stack rollback procedure

Read the hosting stack file at `.claude/stacks/hosting/<provider>.md`, specifically the `### Rollback` subsection under `## Deploy Interface`.

If no `### Rollback` subsection exists, STOP: "Rollback procedure not documented for this hosting provider. See `.claude/patterns/incident-response.md` for manual recovery steps."

## Step 3: Present rollback plan

Present the rollback plan to the user:

```
## Rollback Plan

**Provider:** <provider>
**Target:** <canonical_url>
**Action:** <rollback command or dashboard steps from hosting stack file>

⚠️  This will revert the hosting deployment only.
     Database migrations are NOT rolled back.
     Environment variable changes are NOT rolled back.

Proceed with rollback?
```

**STOP and wait for user approval before continuing.**

## Step 4: Execute rollback

Execute the provider-specific rollback command from the hosting stack file.

If the provider only supports dashboard-based rollback (no CLI command), instruct the user to perform the rollback manually and wait for confirmation.

## Step 5: Health check

After rollback completes, verify the app is responding. Read `experiment/experiment.yaml` to determine the archetype (`type` field, default: `web-app`):

- **web-app or service**: `curl -s <canonical_url>/api/health`
- **cli**: If `canonical_url` exists (surface page), `curl -s <canonical_url>`. Otherwise, skip — CLI rollback only reverts the surface deployment; the CLI binary itself is distributed via package registries and cannot be "rolled back" via hosting.

If the health check fails, report the failure and suggest checking the hosting provider's dashboard for deployment logs.

## Step 6: Report result

Report the rollback result:

```
## Rollback Complete

**Status:** <success or failure>
**URL:** <canonical_url>
**Health check:** <pass or fail>

⚠️  Database is NOT rolled back. If the incident involves data changes,
    see `.claude/patterns/incident-response.md` for database recovery.

**Next steps:**
- Investigate root cause
- Run `/change fix <description>` to fix the underlying issue
- Redeploy with `/deploy` after the fix is merged
```
