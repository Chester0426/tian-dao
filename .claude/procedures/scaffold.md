# Scaffold Procedure

This procedure is executed by a team teammate spawned by `/bootstrap`
after the plan is approved. As an independent Claude Code session, you
have full access to project files, plugins (frontend-design, typescript-lsp),
and tools.

## Scope
Execute Steps 1 through 4c. Do NOT create API routes (Step 5), database
schema (Step 6), tests (Step 7b), or open a PR (Step 9). Those are handled
by the wire teammate.

## Prerequisites
- Branch already created (by bootstrap Step 0)
- Plan approved and saved to `.claude/current-plan.md`
- Read all context files listed in your task assignment before starting

## Steps

### Step 1: Project initialization
- Create `package.json` with `name` from idea.yaml and project setup from the framework stack file (.nvmrc, scripts, engines, tsconfig, config)
- Install packages from all stack files whose categories are present in idea.yaml `stack`
- Install dev dependencies from the framework and UI stack files
- Check if `typescript-language-server` is available globally (`which typescript-language-server`). If not found, tell the user: "The `typescript-lsp` plugin is enabled for this template but requires a global binary. Install it with: `npm install -g typescript-language-server typescript`. This gives Claude real-time type checking during code generation — errors are caught immediately instead of at build time." Then **stop and wait** for the user to confirm they've installed it (or to say "skip"). If the user confirms installation, re-check with `which typescript-language-server` to verify. If the user says "skip", proceed without it.
- Run the UI setup commands from the UI stack file
- After UI setup, verify the UI stack file's post-setup checks pass (PostCSS config, globals.css, scripts intact). If any post-setup check fails: stop and tell the user which check failed and how to fix it (e.g., "PostCSS config was overwritten by shadcn init — restore it from the framework stack file template"). Do not proceed to Step 2 until all post-setup checks pass.
- After post-setup checks pass, make design decisions:
  1. Derive the three design constraints per `.claude/patterns/design.md` (color direction, design philosophy, optimization target) from idea.yaml's product domain.
  2. **Invoke the `frontend-design` skill** (via the Skill tool) with the constraints and idea.yaml content. The skill has full authority over visual direction within the derived constraints.
  3. If the skill is not available (not listed in available skills): stop and tell the user:
     > The `frontend-design` plugin is enabled in `.claude/settings.json` but did not load in this session. Restart Claude Code to reload plugins. If the issue persists, verify `"frontend-design@claude-plugins-official": true` is set in `.claude/settings.json`.
     Then **stop and wait** for the user to confirm it's fixed (or to say "skip"). If the user says "skip", proceed using your own judgment — match the product's personality, not framework defaults.
  4. Record choices in globals.css custom properties and tailwind config per the theme contract in design.md. Font setup applies in Step 3 when layout.tsx is created.
- If any install command fails: stop, show the error, and ask the user to fix the environment issue. After fixing, tell Claude: "Continue the bootstrap on this branch from the install step." Claude will re-run the failed install and any subsequent install commands, then continue with Step 2. Do NOT re-run `/bootstrap` (that would create a duplicate branch). If you close this conversation: either (1) commit partial files on this branch (`git add -A && git commit -m "WIP: partial install"`), then tell Claude "Continue the bootstrap on this branch from the install step"; or (2) switch to main (`git checkout main`), run `make clean`, and start `/bootstrap` fresh.

### Step 2: Core library files
- Create the library files specified in each stack file's "Files to Create" section:
  - If `stack.analytics` is present: analytics library (from the analytics stack file)
  - If `stack.database` is present: database clients (from the database stack file)
- If `stack.auth` is present, create auth files from the auth stack file using the correct conditional path:
  - If `stack.database` matches the auth provider (e.g., both `supabase`): auth shares the database client files — only create auth-specific pages (signup, login)
  - If `stack.database` is absent or a different provider: create standalone auth library files from the "Standalone Client" section (e.g., `supabase-auth.ts` instead of `supabase.ts`)
- If both `stack.auth` and `stack.payment` are present, create auth library files and pages first — payment templates reference `user.id` which requires auth.
- If `stack.payment` is present, create the payment library files from the payment stack file's "Files to Create" section. Note: the payment stack file's checkout route template intentionally references `user.id` which is undefined until auth is integrated — this will cause a build error at Checkpoint B that you must fix by adding the auth check (see the auth stack file's "Server-Side Auth Check" section). The webhook route template also contains a `// TODO: Update user's payment status in database` — unlike the auth check, this TODO compiles silently, so you must resolve it using the database schema planned in Phase 1.
- If `stack.analytics` is present: replace placeholder constants in the analytics library files created by the analytics stack file — replace `PROJECT_NAME = "TODO"` with the `name` from idea.yaml and `PROJECT_OWNER = "TODO"` with the `owner` from idea.yaml. For web-app: replace in both client (`src/lib/analytics.ts`) and server (`src/lib/analytics-server.ts`) files. For service/cli: replace in the server analytics file only (no client-side analytics). These constants auto-attach to every event — if left as TODO, experiment filtering will fail.
- If `stack.analytics` is present: generate `src/lib/events.ts` with typed track wrapper functions from EVENTS.yaml. For each event, create a function like `trackVisitLanding(props: { referrer?: string; utm_source?: string })` that calls `track("visit_landing", props)`. Only generate wrappers for standard_funnel events and (if stack.payment is present) payment_funnel events. Pages should import from `events.ts` instead of calling `track()` directly with string event names.
- If `stack.email` is present, add to EVENTS.yaml `custom_events`:
  - `email_welcome_sent` (trigger: Welcome email sent after signup, properties: `recipient` string required)
  - `email_nudge_sent` (trigger: Activation nudge email sent by cron, properties: `recipient` string required, `days_since_signup` integer required)

### Checkpoint A — verify library layer
- Re-read `.claude/current-plan.md` to confirm implementation aligns with the approved plan.
- Run `npm run build` to verify all library files compile correctly
- If the build fails: fix the errors in the library files before proceeding. These files are imported by every page — errors here cascade into everything downstream. After fixing, re-run `npm run build` to confirm.
- If the build still fails after 2 fix attempts, proceed to the next step without retrying further at this checkpoint — Step 8 (final verification in `.claude/patterns/verify.md`) has its own 3-attempt retry budget that will catch any remaining issues.

### Step 3: App shell
- Follow the framework stack file's file structure and page conventions
- **Root layout**: metadata from idea.yaml `title`, import globals.css. Set up the display font per the UI stack file's "Theme Setup" section (chosen font via `next/font/google`, apply variable to `<html>`). Also implement `retain_return` tracking following the framework stack file's `retain_return` section and EVENTS.yaml
- **404 page**: simple not-found page with link back to `/`
- **Error boundary**: user-friendly message and retry button

### Step 4: Pages from idea.yaml
For each entry in idea.yaml `pages`:
- If `name` is `landing` → create the root page
- Otherwise → create a page at the appropriate route
- Every page file must:
  - Follow page conventions from the framework stack file
  - If `stack.analytics` is present: import tracking functions per the analytics stack file conventions and fire the appropriate EVENTS.yaml event(s) on the correct trigger
  - Follow `.claude/patterns/design.md` quality invariants (form input sizing). Aim for a distinctive, polished look that matches the product domain.
  - If a standard_funnel event from EVENTS.yaml has no matching page in idea.yaml (e.g., no signup page for signup_start/signup_complete), omit that event — do not create a page just to fire it
- **Landing page**: Do NOT generate the landing page content here — it is
  created by a dedicated agent in Step 4c for higher creative quality. If
  idea.yaml has `variants`, create only the structural routing files here:
  - `src/lib/variants.ts` — typed `VARIANTS` array (slug, headline,
    subheadline, cta, pain_points, isDefault) and `getVariant(slug)` helper
  - Root `src/app/page.tsx` — imports and renders `LandingContent` with the
    default variant's props. Fires `visit_landing` with `variant` property.
  - `src/app/v/[variant]/page.tsx` — dynamic route, imports `LandingContent`,
    fires `visit_landing` with `variant` property. `generateStaticParams()`
    for all variant routes. Returns `notFound()` for unknown slugs.
  If no `variants`, skip entirely — Step 4c creates `src/app/page.tsx`.
- **Auth pages (if listed)**: signup/login forms using auth provider UI (see auth stack file). Fire the corresponding EVENTS.yaml events at their specified triggers. Update the post-auth redirect in signup and login pages to navigate to the first non-auth, non-landing page from idea.yaml (e.g., `/dashboard`). If no such page exists, keep the redirect to `/`.
- If `stack.email` is present: wire the welcome email API call into the auth success callback. After `signup_complete` event fires, call `/api/email/welcome` with the user's email and name. Read the email stack file for the route handler template.
- **All other pages**: functional layout following `.claude/patterns/design.md`, with heading, description matching the page's `purpose` from idea.yaml, and a clear next-action CTA. Not blank placeholders — each page should feel like a real product screen

> **STOP** — if `stack.analytics` is present, verify analytics before proceeding. Every page must fire its EVENTS.yaml event(s). Every user action listed in EVENTS.yaml must have a tracking call. Do not move to Checkpoint B until each event is wired. "I'll add analytics later" is not acceptable. If `stack.analytics` is absent, skip this check.

### Checkpoint B — verify pages layer
- Re-read `.claude/current-plan.md` to confirm implementation aligns with the approved plan.
- Run `npm run build` to verify all pages compile and their imports from the library files resolve correctly
- If the build fails: fix the errors in the page files (or in the library files they import from) before proceeding. After fixing, re-run `npm run build` to confirm.
- If the build still fails after 2 fix attempts, proceed to the next step without retrying further at this checkpoint — Step 8 (final verification in `.claude/patterns/verify.md`) has its own 3-attempt retry budget that will catch any remaining issues.

### Step 4b: Evaluate external dependencies

Before generating API routes, assess whether idea.yaml features require external services not covered by `stack`:

1. Read idea.yaml `features`. For each feature, assess: does it require credentials for an external service (OAuth, API key, webhook secret) that is NOT already handled by a `stack` category (database, auth, payment, email, analytics)?
   - Examples: "Connect Xero and import invoices" → Xero OAuth, "Send SMS via Twilio" → Twilio API key, "Sync with Google Sheets" → Google OAuth
   - Stack-handled services don't count: Supabase, Stripe, Resend, PostHog are already managed by their stack files

2. If NO external dependencies detected → skip to Step 4c.

3. **Classify each dependency as core or non-core.** For each external dependency, ask: "If this feature were entirely absent, could users still complete `primary_metric`?" If no → **core**. If yes → **non-core**. Present the classification to the user for confirmation or override:

   > These features require external service credentials not covered by your stack:
   >
   > | Feature | Service | Credentials needed | Classification |
   > |---------|---------|-------------------|----------------|
   > | ... | ... | ... | **core** / **non-core** |
   >
   > Core = removing it prevents users from completing primary_metric ("[value]").
   >
   > Does this classification look right? If so, choose an option for each:

4. **Core features — two options** (no Skip, no Fake Door — core features must have a complete experience):
   - **Provide now** — user gives credentials during bootstrap, Step 5 builds full integration
   - **Provision at deploy** — Step 5 builds full integration code referencing env vars; credentials are obtained during `/deploy` Step 5b. Code must compile without real credentials (guard with runtime check → 503 `{ error: "Service not configured", service: "[name]", setup: "Run /deploy to provision credentials" }`).

5. **Non-core features — three options:**
   - **Fake Door** (default) — real UI + `activate` event with `fake_door: true` + "Coming soon" dialog. Collects intent data from paid traffic. See Step 4 Fake Door integration below.
   - **Skip** — omit the feature from the UI entirely (not a 501 stub — the feature is simply not built)
   - **Full Integration** — same as core "Provide now" (user gives credentials, Step 5 builds it)

6. **Auto-generate external stack files.** For each fully-integrated service (core or non-core with "Full Integration" / "Provide now"), check if `.claude/stacks/external/<service-slug>.md` exists. If not, generate it using the same procedure as Step 2 above for missing stack files:
   - Read `.claude/stacks/TEMPLATE.md` for the required frontmatter schema
   - Read existing stack files as structural reference
   - Generate `.claude/stacks/external/<service-slug>.md` with: OAuth/API flow documentation, required env vars, code templates for client library and route handlers, rate limits and quotas, sandbox/test mode details, and a `## CLI Provisioning` section
   - Set `ci_placeholders: {}` — external service env vars are runtime-only
     (guarded by 503 when missing) and must not appear in CI
   - Run `python3 scripts/validate-frontmatter.py` to verify (max 2 attempts)
   - After generating the external stack file, search the web for the service's
     current official API/OAuth documentation to verify:
     - OAuth scope names and format
     - Authorization and token endpoint URLs
     - Required request parameters and headers
     If any generated value conflicts with the official documentation, update the
     stack file before proceeding.
   - Tell the user: "Generated `.claude/stacks/external/<service-slug>.md` — auto-generated from Claude's knowledge. Review after bootstrap."
   - File an observation per `.claude/patterns/observe.md`

   The generated external stack file must include a `## CLI Provisioning` section. If the service has a CLI that can create credentials:
   ```
   ## CLI Provisioning
   cli: <command-name>
   install: <install-command>
   auth: <auth-check-command>
   provision: <provisioning-command-template>
   ```
   If the service has no CLI, write: "No CLI available — credentials must be obtained via the web dashboard."
   This section is read by `/deploy` to check CLI availability and attempt auto-provisioning.

7. For each service where the user chooses "Provide now" or "Full Integration":
   - Provide brief setup instructions for obtaining the credentials:
     - Where to sign up or access the developer console (include URL)
     - How to create the app/key (3–5 concrete steps)
     - Which credential values to copy (Client ID, API Key, Secret, etc.)
     - Note if a free tier or sandbox is available for MVP testing
   - Then ask the user for the credential values
   - Add env vars to `.env.local` (real values) and `.env.example` (placeholder values only — never real credentials)
   - Step 5 implements the full integration using the credentials (OAuth flow, API calls, etc.)

8. For "Provision at deploy" services:
   - Add env vars to `.env.example` with placeholder values and a comment: `# Provisioned by /deploy`
   - Step 5 builds full integration code referencing these env vars (see Step 5 provision-at-deploy routes below)

#### Fake Door integration (for non-core features choosing Fake Door)

For each Fake Door feature, generate a component in the page folder where the feature would naturally appear (e.g., `src/app/dashboard/sms-fake-door.tsx`):
- Real, polished UI using shadcn components (Card + Button + Dialog), following `.claude/patterns/design.md`
- On button click: `track("activate", { action: "[feature-name]", fake_door: true })`
- Shows a Dialog: "[Feature Name] is coming soon — we're building this now."
- Import and render the Fake Door component in the parent page where the feature would naturally live
- The component should look like a real feature entry point — not a placeholder or disabled button

### Step 4c: Landing page generation (if surface ≠ none)

Resolve the surface type: if `stack.surface` is set in idea.yaml, use it.
Otherwise infer: `stack.hosting` present → `co-located`; absent → `detached`.
Read the surface stack file at `.claude/stacks/surface/<value>.md`.

- **surface: none**: skip this step entirely.

**All other cases**: Launch an Agent (subagent_type: general-purpose) with a
focused creative brief. The agent runs in a clean context — free from the
infrastructure setup that preceded this step.

Include in the agent prompt:

1. The full content of idea.yaml (product context)
2. The three derived constraints from design.md (color direction, design
   philosophy, optimization target — already decided in Step 1)
3. The quality bar from design.md: "Create a world-class, conversion-optimized
   landing page. The visual quality must match a $50K agency page — not
   adequate, exceptional."
4. Copy derivation rules from messaging.md Section A (headline = outcome for
   target_user, CTA = action verb + outcome)
5. Content inventory from messaging.md Section B (raw material, not structure)
6. Instruction: "If the `frontend-design` skill is available in your context,
   invoke it to make visual decisions within the derived constraints, then use
   its output for the page. If the skill is not available, the creative brief
   and constraints above provide sufficient direction — proceed with your own
   creative judgment."
7. Technical context per archetype (see below)

**web-app + co-located** (React component):
- Include: theme tokens (globals.css custom properties, tailwind config from
  Step 1), available shadcn/ui components, analytics function signatures from
  `src/lib/events.ts`, framework page conventions from framework stack file
- If no `variants`: agent writes `src/app/page.tsx` — a complete React landing
  page component. Must fire `visit_landing` on mount with EVENTS.yaml properties.
- If `variants`: agent writes `src/components/landing-content.tsx` — a shared
  `LandingContent` component that accepts variant props (headline, subheadline,
  cta, pain_points). Features section is shared across variants (from idea.yaml
  `features`). The structural routing files (variants.ts, root page, dynamic
  route) were already created in Step 4.

**service + co-located** (self-contained HTML):
- Include: surface stack file content (route path, analytics wiring, CSS approach)
- Agent writes the route handler file at [path from framework stack file]
  returning a complete self-contained HTML page

**cli + detached** (self-contained HTML):
- Include: surface stack file content (file path, CSS approach)
- Agent writes `site/index.html` as a complete self-contained HTML page

After the agent returns, verify the output:
- Wire analytics if `stack.analytics` is present and not already included by
  the agent (add inline snippet for service/cli per surface stack file's
  analytics section; for web-app, verify event imports and tracking calls)
- Run `npm run build` to verify the landing page compiles (web-app only)

## Completion Report

When all steps are complete, report:
1. Checkpoint A result (pass/fail, attempt count)
2. Checkpoint B result (pass/fail, attempt count)
3. External dependencies: [service] → [core/non-core] → [chosen option]
4. User decisions made during Step 4b (credentials provided, fake doors chosen)
5. Rule 12 observations (template file, symptom, workaround)
6. Generated external stack files (paths)
7. Env vars added to .env.local (if any)
