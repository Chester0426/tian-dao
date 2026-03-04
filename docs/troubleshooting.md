# Troubleshooting

> These steps assume the default stack (Next.js, Supabase, Vercel, PostHog). If you changed your stack, adjust service-specific steps accordingly.

## make validate errors

**"TODO placeholders"**
Open `idea/idea.yaml` and replace every `TODO` with your actual content. See `idea/idea.example.yaml` for a complete example.

**"invalid YAML syntax"**
Check `idea/idea.yaml` for indentation errors or missing colons. YAML requires consistent spacing (2 spaces, no tabs). Use a YAML validator if unsure.

**"PyYAML is not installed"**
Run `pip3 install pyyaml` to install the required Python YAML library.

**"name must be lowercase"**
The `name` field in idea.yaml must start with a letter and use only lowercase letters, numbers, and hyphens (e.g., `my-experiment-1`).

**"pages must include landing"**
Add an entry with `name: landing` to the `pages` list in idea.yaml. Every web-app experiment needs a landing page.

**"commands is required" or "endpoints is required"**
For `type: service`, idea.yaml needs an `endpoints` list instead of `pages`. For `type: cli`, it needs a `commands` list. See `.claude/archetypes/` for the required fields per type.

**"excluded stack" error**
Some stacks are not compatible with certain archetypes. For example, `type: cli` cannot use `hosting`, `ui`, `auth`, `payment`, or `email`. Remove the excluded stacks from your idea.yaml.

## /bootstrap errors

**"Not a git repository"**
Make sure you're in a cloned repo. Run `git init` or clone your repo first.

**"uncommitted changes"**
Commit your idea.yaml changes first: `git add idea/idea.yaml && git commit -m "Fill in idea.yaml"`. The branch setup requires a clean working tree.

**"GitHub CLI is not authenticated"**
Run `gh auth login` and follow the prompts to authenticate.

**"No origin remote"**
Your repo needs a remote. Run: `git remote add origin https://github.com/<your-username>/<your-repo-name>.git`

**Bootstrap partially failed (e.g., npm install worked but shadcn init didn't)**
Run `make clean` to remove generated files, then try `/bootstrap` again.

## /verify errors

**E2E tests fail with "connection refused on port 54321"**
Local Supabase is not running. Run `make supabase-start` to start it. Make sure Docker Desktop is running first.

**`supabase start` fails with Docker daemon error**
Docker Desktop is not running. Start Docker Desktop, wait for it to initialize, then retry `make supabase-start`.

**Two experiments won't run locally at the same time**
Run the second one on a different port: `npm run dev -- -p 3001`

## Build / post-bootstrap errors

**Build fails after bootstrap**
Check that `.env.local` has all variables from `.env.example`.

**App crashes with "relation does not exist"**
Database tables haven't been created yet. If using the Supabase Vercel Integration, re-deploy to trigger auto-migration (push an empty commit: `git commit --allow-empty -m "trigger deploy" && git push`). Check Vercel build logs for `[auto-migrate]` messages. If not using the integration: run `make migrate` or copy SQL from `supabase/migrations/` into Supabase Dashboard > SQL Editor.

**PostHog events aren't showing up**
PostHog credentials are hardcoded in the analytics libraries (shared publishable key). Open browser DevTools > Network tab and look for requests to `posthog`. If no requests appear, verify the analytics library is being imported and `track()` calls are firing on user actions.

## /deploy and production errors

**`make deploy` asks to link a project**
This is normal on first deploy. Follow the Vercel CLI prompts to link your repo to a Vercel project.

**Health check fails after deploy**
Check that the Supabase Vercel Integration is connected (Vercel Project > Integrations). If you set env vars manually, verify all keys from `.env.example` are present in Vercel (Project > Settings > Environment Variables). If migrations haven't been applied, paste the SQL from `supabase/migrations/` into Supabase Dashboard > SQL Editor.

**Vercel deploy fails with missing env vars**
Add the Supabase Vercel Integration at [vercel.com/integrations/supabase](https://vercel.com/integrations/supabase) to auto-inject Supabase env vars. For other variables (Stripe, etc.), add them manually in Vercel Project > Settings > Environment Variables.

**Stripe — "API key missing" at runtime**
If you have `payment: stripe` in idea.yaml, add your Stripe keys to Vercel environment variables. Find them in Stripe Dashboard > Developers > API keys.

**Resend — emails not sending**
If you have `email: resend` in idea.yaml, add `RESEND_API_KEY` and `CRON_SECRET` to Vercel environment variables. Get your API key from [resend.com](https://resend.com) > API Keys.

**Branch already exists**
The branch setup handles this automatically by appending `-2`, `-3`, etc.

## Runtime / iteration errors

**A skill failed partway through (e.g., build error, network issue)**
You have two options:
1. **Resume:** switch to the branch (`git checkout <branch-name>`) and run `claude` to pick up where it left off.
2. **Start fresh:** delete the branch (`git branch -D <branch-name>`) and re-run the skill.

## Still stuck?

Open Claude Code in your project folder and describe the error. Claude can read logs, check configuration, and suggest fixes directly.
