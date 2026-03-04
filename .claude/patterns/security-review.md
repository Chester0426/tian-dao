# Security Review Procedure

Review all changed files for security issues that compile successfully but
create runtime vulnerabilities. This enforces CLAUDE.md Rule 6.

## 1. Plugin Check

**Invoke the `security-guidance` skill** (via the Skill tool) to review all
changed files. The skill has full authority over security analysis — it
catches vulnerabilities that compile successfully but create runtime holes
(hardcoded secrets, missing validation, absent access control).

If the skill is not available (not listed in available skills): stop and
tell the user:

> The `security-guidance` plugin provides automated security analysis of
> your code changes — catching hardcoded secrets, missing input validation,
> absent RLS policies, and client/server boundary violations.
>
> It is enabled in `.claude/settings.json` but did not load in this
> session. Restart Claude Code to reload plugins. If the issue persists,
> verify `"security-guidance@claude-plugins-official": true` is set in
> `.claude/settings.json`.

Then **stop and wait** for the user to confirm it's fixed (or to say
"skip"). If the user says "skip", proceed with the manual fallback
checklist below.

## 2. Manual Fallback Checklist

> Only used when the security-guidance skill is skipped.

Scan all files in `src/` for the following issues:

### 2a. Hardcoded Secrets

Search for secret-like patterns: `sk_live_`, `sk_test_`, `sbp_`, `supabase_service_role`,
`-----BEGIN`, API keys assigned to string literals. Any match is a FAIL.

### 2b. Input Validation

Every API route handler must validate input with zod (or similar). Check
each `route.ts` / `route.js` file — if the handler reads `request.json()`,
`request.formData()`, or URL params without schema validation, it's a FAIL.

### 2c. Database RLS

> Skip if `stack.database` is absent from idea.yaml.

Every `CREATE TABLE` statement must have a corresponding
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one policy. Check
migration files and schema definitions. Missing RLS is a FAIL.

### 2d. Client/Server Boundary

> Skip for `service` and `cli` archetypes — web-app only.

Server-only environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `*_SECRET_*`,
`*_ADMIN_*`) must not be imported or referenced in files marked `"use client"`.
Any match is a FAIL.

### 2e. Rate Limiting

Auth and payment API routes (`/api/auth/**`, `/api/payment/**`,
`/api/checkout/**`, `/api/webhook/**`) must include rate limiting. Missing
rate limiting is a FAIL. See hosting stack file for deployment-specific
constraints.

### Archetype Scope

- **web-app**: all checks (2a–2e)
- **service**: 2a, 2b, 2c, 2e (skip 2d — no client/server boundary)
- **cli**: 2a, 2b only (no database, no server routes)

## 3. Fix Cycle (max 2 cycles)

If security issues are found:

1. Fix the code
2. Run `npm run build` (must still pass)
3. Re-run the failed checks
4. Re-review

Repeat up to **2 fix cycles**. If issues remain after 2 cycles, report
them to the user and proceed — do not block the commit.

## 4. Report

Summarize results as a pass/FAIL table:

| Check | Status |
|-------|--------|
| 2a. Hardcoded secrets | pass/FAIL |
| 2b. Input validation | pass/FAIL |
| 2c. Database RLS | pass/FAIL/skip |
| 2d. Client/server boundary | pass/FAIL/skip |
| 2e. Rate limiting | pass/FAIL |

Any unfixed FAIL items must be noted in the PR body under a
**Security Notes** section so reviewers are aware.
