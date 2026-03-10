# Experiment Template

![CI](https://github.com/magpiexyz-lab/mvp-template/actions/workflows/ci.yml/badge.svg)

## What is this

You fill in a YAML file describing your idea. Claude Code builds the app, deploys it, and helps you iterate with real user data. The whole cycle — from idea to live experiment with analytics — takes under an hour.

## Your workflow

```
experiment.yaml → make validate → /bootstrap → merge PR → /verify
                                                        │
                    ┌───────────────────────────────────┘
                    │
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
     web-app      service         cli
        │           │              │
   /deploy       /deploy      npm publish
        │           │              │
   /distribute      │              │
   (optional)       │              │
        │           │              │
        └───────────┼──────────────┘
                    │
              Share with users
              Check analytics
                    │
               /iterate
           (recommendations)
                    │
            /change [description]
               /verify
              merge PR
                    │
               /retro
          (when experiment ends)
                    │
        ┌───────────┴──────────────┐
        ▼                          ▼
   /teardown                    done
   (web-app / service)         (cli)
```

Every command that writes code shows you a plan first and waits for your approval before changing anything.

## First-time setup

Do this once. Ask a technical teammate to help if needed.

1. **Install tools** — Python, Node.js, GitHub CLI, and optionally Docker. See [docs/prerequisites.md](docs/prerequisites.md).
2. **Create service accounts** — Claude Code, GitHub, and the services your stack uses. See [docs/prerequisites.md](docs/prerequisites.md).
3. **Open Claude Code** in this repo folder.

## Step by step

### 1. Describe your idea

Edit `idea/experiment.yaml` — replace every `TODO` with your actual content. See `idea/experiment.example.yaml` (the QuickBill example) for reference.

Key fields:
- **name** — a short slug for your project (used in analytics, e.g., `quick-bill`)
- **type** — what you're building: `web-app` (default), `service` (API only), or `cli` (command-line tool)
- **pages / endpoints / commands** — what your app contains (depends on type). Claude builds exactly these, no more.
- **features** — up to ~5 things your app does
- **primary_metric** — the one number that tells you if this worked
- **target_value** — what success looks like (e.g., "10 paid users")
- **measurement_window** — how long to run (e.g., "2 weeks")
- **stack** — technologies to use. The defaults work for most experiments.

Run `make validate` to check for errors before continuing.

### 2. Build

Open Claude Code and type `/bootstrap`. Claude will:

1. Read your experiment.yaml and present a build plan
2. **Wait for your approval** — nothing happens until you say yes
3. Generate the full app and open a pull request

Review the PR on GitHub and merge it to `main`.

### 3. Verify (recommended)

After merging, run `/verify` in Claude Code. It runs tests automatically and fixes any failures it finds.

> Docker Desktop must be running for projects with `stack.database: supabase`.

### 4. Deploy

- **web-app / service:** Run `/deploy` in Claude Code. You'll need `vercel login` and `npx supabase login` done first (one-time). For non-Vercel hosting, see your stack file at `.claude/stacks/hosting/`.
- **cli:** Publish with `npm publish` or create a GitHub Release. No `/deploy` needed.

### 5. Iterate

1. **Share with users** — your app is live after merging and deploying
2. **Distribute (optional, web-app only)** — run `/distribute` to generate ad campaign configs
3. **Check analytics** — wait a few days, then look at your dashboards
4. **Get recommendations** — run `/iterate` for Claude to analyze your funnel
5. **Make changes** — run `/change [description]` to add features, fix bugs, or polish
6. **Verify and merge** — run `/verify`, then merge the PR
7. **Repeat** — keep iterating until you hit your target or the measurement window ends
8. **Retrospective** — run `/retro` when the experiment ends
9. **Tear down (web-app / service)** — run `/teardown` to remove cloud resources

## Skills reference

| Skill | What it does | Waits for approval? |
|-------|-------------|---------------------|
| `/bootstrap` | Generate the full app from experiment.yaml | Yes |
| `/change [description]` | Add a feature, fix a bug, polish UI, fix analytics, add tests | Yes |
| `/verify` | Run tests and auto-fix failures | No |
| `/deploy` | Deploy to hosting + database (first-time setup) | Yes |
| `/distribute` | Generate ad campaign config (web-app only) | Yes |
| `/iterate` | Analyze metrics, recommend next steps (no code changes) | No |
| `/retro` | Run a retrospective and file feedback as GitHub issue | No |
| `/teardown` | Remove cloud resources (Vercel project, Supabase project) | Yes |
| `/review` | Automated review-fix loop *(maintainers only)* | Yes |

## Common issues

1. **`make validate` fails with TODOs** — open experiment.yaml and replace every `TODO`
2. **`/bootstrap` fails** — run `gh auth login` to authenticate GitHub CLI
3. **`/verify` fails** — make sure Docker Desktop is running (for supabase projects)
4. **Build fails** — check that `.env.local` has all variables from `.env.example`
5. **`/deploy` fails** — run `vercel login` and `npx supabase login` first

For 20+ more issues, see [docs/troubleshooting.md](docs/troubleshooting.md).

## More docs

- [docs/prerequisites.md](docs/prerequisites.md) — Full setup instructions
- [docs/troubleshooting.md](docs/troubleshooting.md) — All known issues
- [docs/technical-reference.md](docs/technical-reference.md) — Project structure, migrations, branch protection, stack and archetype reference, extending the template
- [docs/google-ads-setup.md](docs/google-ads-setup.md) — Google Ads setup for /distribute

**Default stack:** Next.js (App Router), Supabase (database & auth), PostHog (analytics), Vercel (hosting), shadcn/ui, Playwright (testing). Override any of these in experiment.yaml `stack`.
