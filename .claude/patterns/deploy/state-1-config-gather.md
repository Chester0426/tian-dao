# STATE 1: CONFIG_GATHER

**PRECONDITIONS:**
- Pre-flight checks passed (STATE 0 POSTCONDITIONS met)
- experiment.yaml read and parsed
- Archetype and surface type resolved

**ACTIONS:**

1. **Hosting config** (skip for surface-only deployments)**:** Read the hosting stack file's `## Deploy Interface > Config Gathering`. Follow the instructions to discover the team/org/account (e.g., run the CLI command listed there). Check the experiment.yaml field listed in the stack file — if set, skip the prompt.
2. **Database config** (if `stack.database` is present): Read the database stack file's `## Deploy Interface > Config Gathering`. Follow the instructions to discover the org/region/account. Check the experiment.yaml fields listed — if set, skip the prompts.
3. **DB password** (if applicable): Generate with `openssl rand -base64 24`.
5. **Stripe keys** (if `stack.payment` is present): Ask the user for `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. If Stripe CLI is available, the webhook secret will be auto-generated in Step 5. If not, also ask for `STRIPE_WEBHOOK_SECRET`.
7. **OAuth provider credentials** (if `stack.auth_providers` present):
   - If `deploy-manifest.json` exists (re-run): Supabase ref is known -> collect credentials now
   - If first deploy: note that OAuth needs setup after Step 3 creates the Supabase project
   - For each provider, tell the user:
     > Create an OAuth app at [provider console URL].
     > Set redirect URI to: `https://<ref>.supabase.co/auth/v1/callback`
     > Paste Client ID and Secret here, or type **skip** to configure later.
   - Provider console URLs: google -> console.cloud.google.com/apis/credentials,
     github -> github.com/settings/developers, apple -> developer.apple.com/account/resources/authkeys,
     discord -> discord.com/developers/applications, gitlab -> gitlab.com/-/user_settings/applications
   - Store credentials in memory (never in files — secrets go to Management API only)
6. **External service credentials**: Read `.env.example`, collect env vars not handled by stack categories. For each external service, use CLI status from Step 0.10:
   - **Auto via CLI** — installed + authenticated -> will auto-provision in Step 5b
   - **Manual (CLI available)** — CLI exists but not installed/authed -> user can install to enable auto
   - **Manual (no CLI)** — no CLI for this service -> web dashboard
   - Note: Fake Door features have no env vars and no API routes — UI-only. Skip them.

**POSTCONDITIONS:**
- Hosting config gathered (team/org/account) or skipped for surface-only
- Database config gathered (org/region) or skipped
- DB password generated (if applicable)
- Stripe keys collected (if applicable)
- OAuth credentials collected or deferred to Step 3.5
- External service credentials categorized (auto/manual)

**VERIFY:**
```bash
echo "Config gathering complete — verify in context"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh deploy 1
```

**NEXT:** Read [state-2-user-approval.md](state-2-user-approval.md) to continue.
