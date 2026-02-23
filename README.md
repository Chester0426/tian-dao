# Experiment Template

![CI](https://github.com/magpiexyz-lab/mvp-template/actions/workflows/ci.yml/badge.svg)

A template repository for running parallel MVP experiments. Fill in your idea, run a command, get a deployable app.

## How It Works

> **For non-technical team members:** You don't need to understand every term in this document. The key steps are: fill in idea.yaml (Step 1), approve the build plan in Claude Code (Step 2), and deploy (Step 4). Claude handles the code. For first-time setup, ask a technical teammate to help install the prerequisites.

```
1. Fill in idea.yaml  →  /bootstrap  →  Review & merge PR  →  Deploy (first time)
                                                                  ↓
                                                           Share with users
                                                                  ↓
                                                           /distribute (optional)
                                                                  ↓
4. Act on recommendations  ←  3. /iterate  ←  2. Check analytics dashboards
   (/change ...)               (analysis only — no PR)
           ↓
   /verify  →  Review & merge PR  →  Auto-deployed  →  Repeat
```

Every skill except `/iterate` and `/retro` creates a branch, does the work, and opens a PR for you to review and merge. `/iterate` and `/retro` are analysis-only — they don't create branches or PRs. AI skills are invoked directly in Claude Code (not through `make`).

**Plan-Approve-Execute**: Every code-writing skill follows a three-phase workflow. First, Claude reads your idea.yaml and presents a plain-language plan. Then it **stops and waits** for your approval. Only after you say "approve" does it write any code. This keeps you in control — you can adjust the plan before any files are changed.

## Prerequisites

Install these before starting:

- [Python 3](https://www.python.org/) with PyYAML — `python3 --version` to check; run `pip3 install pyyaml` if needed (used by `make validate` and CI)
- [Node.js](https://nodejs.org/) 20+ — `node --version` to check
- [Claude Code](https://claude.ai/code) — `claude --version` to check (requires a paid plan or API credits — see [pricing](https://claude.ai/pricing))
- **npm** (bundled with Node.js) — this template uses npm exclusively; do not use yarn or pnpm
- [GitHub CLI](https://cli.github.com/) — `gh --version` to check, then `gh auth login`
- [Supabase](https://supabase.com/) account — the Supabase Vercel Integration creates a project for you during deployment *(default stack — see idea.yaml `stack` section)*
- [PostHog](https://posthog.com/) project — one shared project for all experiments *(default stack)*
- [Vercel](https://vercel.com/) account — for deployment *(default stack)*
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required when using `stack.testing` with `stack.database: supabase` (E2E tests run against a local Supabase instance)

> **Note:** The prerequisites above assume the default stack (Supabase, PostHog, Vercel). If you change `stack` values in idea.yaml, substitute the corresponding services.

## Quick Start

### 1. Create your repo & describe your idea

Click **"Use this template"** on GitHub to create a new repository. Then clone it and fill in your idea:

```bash
gh repo clone <your-username>/<your-repo-name>
cd <your-repo-name>
```

Edit `idea/idea.yaml` — replace every `TODO` with your actual content. See `idea/idea.example.yaml` for a complete example.

The key fields:
- **name**: slug for your project (used in analytics)
- **pages**: every page in your app — Claude builds exactly these, no more
- **features**: up to ~5 capabilities
- **primary_metric**: the one number that tells you if this worked

### 2. Build your app

```bash
make validate    # Check for any unfilled TODOs
git add idea/idea.yaml && git commit -m "Fill in idea.yaml"
```

Then open Claude Code and run `/bootstrap` to generate the full MVP. Claude will:
1. Read your idea.yaml and present a build plan
2. Wait for your approval
3. Generate the full MVP (pages, auth, analytics, API routes)
4. Open a PR for you to review and merge

### 3. Verify it works

After merging the bootstrap PR, run one command:

```bash
make verify-local
```

This automatically installs dependencies, starts local Supabase (if configured), generates `.env.local` with local keys, runs E2E tests, and cleans up. Just needs Docker running.

> **Note:** Docker Desktop is required for projects with `stack.database: supabase`. The script detects your stack from config files and skips services you don't use.

If tests fail, debug interactively with `npx playwright test --ui` or run `/verify` in Claude Code to auto-fix.

### 4. Go live

1. **Import your repo** at [vercel.com/new](https://vercel.com/new)

2. **Add the Supabase integration** — during Vercel project setup (or after, at [vercel.com/integrations/supabase](https://vercel.com/integrations/supabase)):
   - Select your Vercel project
   - The integration creates a Supabase project and auto-injects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into Vercel

3. **Apply database migrations** — open your new Supabase project's Dashboard → SQL Editor, paste the contents of each file in `supabase/migrations/` (in order), and click **Run**

4. **Done** — Vercel auto-deploys on every merge to `main`. PostHog analytics are pre-configured.

> **Stripe (if enabled):** If you have `payment: stripe` in idea.yaml, manually add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` in Vercel (Project → Settings → Environment Variables). Find these in Stripe Dashboard → Developers → API keys.

> **Without the integration:** Copy keys from Supabase Dashboard → Project Home → Data API popup into Vercel Project → Settings → Environment Variables. For CLI migration, see [Migration Setup](#migration-setup).

## Commands

Run `make` to see all available utility commands:

| Command | What it does |
|---------|-------------|
| `make validate` | Check idea.yaml for valid YAML, TODOs, name format, and landing page |
| `make verify-local` | Verify the app works locally (install, test, cleanup) — just needs Docker |
| `make supabase-start` | Start local Supabase for testing (requires Docker) |
| `make supabase-stop` | Stop local Supabase |
| `make test-e2e` | Run Playwright E2E tests |
| `make distribute` | Validate idea/ads.yaml (valid YAML, schema, budget limits) |
| `make migrate` | Push pending Supabase migrations to remote database |
| `make deploy` | Deploy to Vercel (first-time setup or manual deploys) |
| `make clean` | Remove generated files (lets you re-run bootstrap) |
| `make clean-all` | Remove everything including migrations (full reset) |

AI skills are invoked directly in Claude Code:

| Skill | What it does |
|-------|-------------|
| `/bootstrap` | Generate the full MVP from `idea/idea.yaml` |
| `/change ...` | Make any change: add feature, fix bug, polish UI, fix analytics, add tests |
| `/verify` | Run E2E tests and fix failures (quality gate after `/change`) |
| `/iterate` | Review metrics and get recommendations for next steps |
| `/retro` | Run a retrospective and file feedback as GitHub issue |
| `/distribute` | Generate Google Ads campaign config from idea.yaml |

## Workflow

After bootstrap, the typical workflow is:

> **Note:** The commands below assume the default stack. If you've changed your stack, some steps (e.g., deploy target, database setup) will differ — check your stack files in `.claude/stacks/` for details.

1. **Share with users** — your app is live after merging the bootstrap PR (auto-deployed by Vercel)
2. **Distribute (optional)** — run `/distribute` to generate a Google Ads campaign config, then set it up in Google Ads (see `docs/google-ads-setup.md`)
3. **Collect data** — wait a few days, check your analytics dashboards
4. **Review progress** — `/iterate` to analyze your funnel and get recommendations (this is analysis-only — it does not create a branch or PR)
5. **Act on recommendations** — run the suggested skill:
   - `/change ...` to add a feature, fix a bug, polish UI, fix analytics, or add tests
6. **Verify** — run `/verify` to run E2E tests and auto-fix failures before merging
7. **Review and merge PRs** — each skill opens a PR for you to review; merging auto-deploys to production
8. **Repeat** — measure, iterate until you hit `target_value` or `measurement_window` ends
9. **Retrospective** — when the experiment ends, run `/retro` to generate structured feedback and file it on the template repo

## Retrospectives

At the end of an experiment (or when `measurement_window` ends), run a retrospective:

1. Open Claude Code and run **`/retro`**
2. Claude gathers git/PR data, asks you 4 questions, and generates a structured summary
3. Claude files the retro as a GitHub Issue on your template repo

The retro follows the template in `idea/retro-template.md`. Issues are labeled `retro` and accumulate on the template repo, giving the template owner a searchable archive of feedback across all experiments.

**Setup:** Add `template_repo: owner/repo-name` to your `idea/idea.yaml` so Claude knows where to file the issue. If not set, Claude will ask you during the retro.

## Analytics

All experiments share a single analytics project (PostHog by default). Every event includes `project_name` and `project_owner` properties so you can filter dashboards by experiment.

See [`EVENTS.yaml`](./EVENTS.yaml) for the full event dictionary.

## Post-Setup: Branch Protection

After your first PR is merged, protect the `main` branch:

1. Go to **Settings > Branches** in your GitHub repo
2. Click **Add branch ruleset** for `main`
3. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass** — select `validate`, `build`, `e2e`, `preview-smoke`, and `secret-scan`
4. Save

## Migration Setup

If your project uses `stack.database: supabase`, set up automated migrations so database schema changes are applied when PRs merge to `main`.

### CI auto-migration (recommended)

Add three GitHub repository secrets (Settings → Secrets and variables → Actions):

1. **`SUPABASE_PROJECT_REF`** — Supabase Dashboard → Settings → General → Reference ID
2. **`SUPABASE_DB_PASSWORD`** — Supabase Dashboard → Settings → Database → Database password
3. **`SUPABASE_ACCESS_TOKEN`** — [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)

Once configured, the `migrate` CI job applies pending migrations automatically on every merge to `main`.

### Manual alternative

If you prefer not to configure CI secrets:

```bash
npx supabase login              # One-time: authenticate CLI
npx supabase link --project-ref <ref>  # One-time: link to remote project
export SUPABASE_DB_PASSWORD=your-password
make migrate
```

> **Fallback:** You can always copy SQL from `supabase/migrations/` into Supabase Dashboard → SQL Editor.

## Troubleshooting

> **Note:** The troubleshooting steps below assume the default stack. If you've changed your stack, adjust service-specific steps accordingly.

**`make validate` fails with "TODO placeholders"**
→ Open `idea/idea.yaml` and replace every `TODO` with your actual content. See `idea/idea.example.yaml` for a complete example.

**`make validate` fails with "invalid YAML syntax"**
→ Check `idea/idea.yaml` for indentation errors or missing colons. YAML requires consistent spacing (2 spaces, no tabs). Use a YAML validator if unsure.

**`make validate` fails with "PyYAML is not installed"**
→ Run `pip3 install pyyaml` to install the required Python YAML library.

**`make validate` fails with "name must be lowercase"**
→ The `name` field in idea.yaml must start with a letter and use only lowercase letters, numbers, and hyphens (e.g., `my-experiment-1`).

**`make validate` fails with "pages must include landing"**
→ Add an entry with `name: landing` to the `pages` list in idea.yaml. Every experiment needs a landing page.

**`/bootstrap` fails with "Not a git repository"**
→ Make sure you're in a cloned repo. Run `git init` or clone your repo first.

**`/bootstrap` fails with "uncommitted changes"**
→ You need to commit your idea.yaml changes first: `git add idea/idea.yaml && git commit -m "Fill in idea.yaml"`. The branch setup requires a clean working tree before creating a feature branch.

**`/bootstrap` fails with "GitHub CLI is not authenticated"**
→ Run `gh auth login` and follow the prompts to authenticate.

**`/bootstrap` fails with "No origin remote"**
→ Your repo needs a remote. Run: `git remote add origin https://github.com/<your-username>/<your-repo-name>.git`

**Build fails after bootstrap**
→ Check that `.env.local` has all variables from `.env.example`

**App crashes with "relation does not exist"**
→ Database tables haven't been created yet. Run `make migrate` to push migrations to the remote database. If CI secrets are configured, check the CI workflow run for errors. Fallback: copy SQL from `supabase/migrations/` into Supabase Dashboard → SQL Editor.

**PostHog events aren't showing up**
→ Check that `NEXT_PUBLIC_POSTHOG_KEY` in `.env.local` matches your PostHog project API key. Check that `NEXT_PUBLIC_POSTHOG_HOST` is `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU). Open browser DevTools → Network tab and look for requests to `posthog`.

**`make deploy` asks to link a project**
→ This is normal on first deploy. Follow the Vercel CLI prompts to link your repo to a Vercel project. After linking, future deploys will work automatically.

**Health check fails after deploy**
→ Check that the Supabase Vercel Integration is connected (Vercel Project → Integrations). If you set env vars manually, verify all keys from `.env.example` are present in Vercel (Project → Settings → Environment Variables). If migrations haven't been applied, paste the SQL from `supabase/migrations/` into Supabase Dashboard → SQL Editor.

**Vercel deploy fails with missing env vars**
→ Add the Supabase Vercel Integration at [vercel.com/integrations/supabase](https://vercel.com/integrations/supabase) to auto-inject Supabase env vars. For other variables (Stripe, etc.), add them manually in Vercel Project → Settings → Environment Variables.

**Bootstrap partially failed (e.g., npm install worked but shadcn init didn't)**
→ Run `make clean` to remove generated files, then try `/bootstrap` again.

**Branch already exists**
→ The branch setup handles this automatically by appending `-2`, `-3`, etc.

**A skill failed partway through (e.g., build error, network issue)**
→ You have two options:
  1. **Resume:** switch to the branch (`git checkout <branch-name>`) and run `claude` to pick up where it left off.
  2. **Start fresh:** delete the branch (`git branch -D <branch-name>`) and re-run the skill.

**E2E tests fail with "connection refused on port 54321"**
→ Local Supabase is not running. Run `make supabase-start` to start it. Make sure Docker Desktop is running first.

**`supabase start` fails with Docker daemon error**
→ Docker Desktop is not running. Start Docker Desktop, wait for it to initialize, then retry `make supabase-start`.

**Two experiments won't run locally at the same time**
→ Run the second one on a different port: `npm run dev -- -p 3001`

## Project Structure

```
idea/idea.yaml           # Your experiment definition (edit this first)
idea/idea.example.yaml   # Worked example for reference
idea/retro-template.md   # Retrospective template (used at end of experiment)
CLAUDE.md                # Rules for Claude Code (don't edit unless you know what you're doing)
EVENTS.yaml              # Analytics event dictionary
.claude/commands/        # Claude Code skills (bootstrap, change, verify, iterate, retro, distribute)
.claude/patterns/        # Shared patterns referenced by skills (verification procedure, etc.)
.claude/stacks/          # Stack implementation files (one per technology — framework, database, auth, testing, etc.)
.github/                 # PR template and CI workflow
.gitleaks.toml           # Secret scanning configuration
Makefile                 # Utility command shortcuts — run `make` to see all
.nvmrc                   # Node.js version (20)
supabase/config.toml     # Local Supabase configuration (generated by supabase init, committed)
supabase/migrations/     # Database migrations (default database stack) (generated by bootstrap/change, auto-applied by CI on merge)
src/                     # App code (generated by /bootstrap)
```

> **Tip:** `idea.example.yaml` shows a full 7-page app with payments. For a simpler starting point, you only need a `landing` page and one feature — everything else is optional.

## Extending This Template

### Adding a new stack option

To support a new technology (e.g., Firebase instead of Supabase):

1. Create a stack file at `.claude/stacks/<category>/<value>.md` (e.g., `.claude/stacks/database/firebase.md`)
2. Use `.claude/stacks/TEMPLATE.md` as a starting point — it documents the required and optional sections
3. Set the corresponding `stack.<category>` value in idea.yaml to match the filename
4. Skills will automatically read your new stack file — no changes to skill files needed

> **Note:** Swapping a framework or database stack may also require updates to `CLAUDE.md` (rules 9-10), the `Makefile` (`clean` and `deploy` targets), `.gitignore`, and `.github/workflows/ci.yml` (build env vars). Review each for stack-specific references.

> **Important:** Stack files may depend on other stacks. Each file declares its assumptions in an `> Assumes:` line at the top (e.g., `database/supabase.md` assumes `framework/nextjs`). When swapping a stack, check the `> Assumes:` lines in related files to see what else needs updating.

### Adding a new skill

Most code-writing changes should go through the unified `change` skill rather than creating new skills. Only add a new skill if it has a fundamentally different workflow (e.g., analysis-only like `iterate`).

1. Create a command file at `.claude/commands/<skill-name>.md` with the skill's instructions
2. Add YAML frontmatter at the top of the file with required keys: `type`, `reads`, `stack_categories`, `requires_approval`, `references`, `branch_prefix`, `modifies_specs`. See existing skill files for examples.
3. For code-writing skills: add `.claude/patterns/branch.md` and `.claude/patterns/verify.md` to the `references` list, and add a Step 0 that invokes the branch setup procedure
4. Update the skill tables in this README
5. Update the skill list in CLAUDE.md Rule 0
