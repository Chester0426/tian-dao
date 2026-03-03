---
assumes: []
packages:
  runtime: []
  dev: []
files: []
env:
  server: []
  client: []
ci_placeholders: {}
clean:
  files: []
  dirs: []
gitignore: []
---
# Hosting: Railway
> Used when idea.yaml has `stack.hosting: railway`
> Assumes: nothing (framework-agnostic — works with any Node.js framework)

## Deployment

Railway supports two deployment modes:

1. **Nixpacks (default)** — auto-detects Node.js, installs dependencies, runs `npm run build`, then `npm start`. Zero config needed.
2. **Dockerfile** — for custom builds, place a `Dockerfile` in the project root. Railway auto-detects and uses it.

### Manual Deploy (CLI)
```bash
railway up
```

### Auto-Deploy on Push
- Railway's GitHub integration auto-deploys on every push to `main`
- Preview environments can be enabled per-branch in Railway dashboard
- `make deploy` remains available for manual CLI deploys and first-time project linking
- Skills should not include `make deploy` as a required iteration step — pushing to `main` is sufficient when GitHub integration is active

## Health Check

The health check endpoint lives at `/api/health` (or the framework's equivalent route). The **framework stack file** creates the actual handler — Railway just needs to know the URL.

**Railway health check config** (set in dashboard or `railway.toml`):
- Health check path: `/api/health`
- Health check timeout: 5s (default)

The health check handler follows the same pattern as other hosting providers — returns JSON `{ status: "ok", ... }` with service-specific checks added by bootstrap based on active stack. See the hosting/vercel stack file's Health Check section for the response pattern.

## Dockerfile Template

When Nixpacks auto-detect is insufficient (e.g., monorepo, custom build steps), use this Dockerfile:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE ${PORT:-3000}
CMD ["npm", "start"]
```

- `node:20-slim` matches the `.nvmrc` Node version
- `npm ci --omit=dev` installs only production dependencies
- `PORT` is provided by Railway at runtime — the app must listen on `process.env.PORT`

## Environment Variables

Railway injects `PORT` automatically — the app must listen on it. All other env vars are set via:

- **Railway dashboard:** Service → Variables tab
- **Railway CLI:** `railway variables set KEY=VALUE`
- **Shared variables:** Use Railway's shared variables for values used across services

### Framework Considerations
- Railway does NOT use the `NEXT_PUBLIC_` prefix convention — client-side env vars are framework-specific
- For Next.js on Railway: `NEXT_PUBLIC_*` vars must be available at **build time** (set them as Railway variables, not runtime-only secrets)
- For Hono/Express: all env vars are server-side only — no prefix convention needed

## CLI Setup (Non-Interactive)

Used by the `/deploy` skill for automated first-time setup.

### Project Setup
```bash
railway login
railway init          # creates a new project
railway link          # links to existing project
railway service       # select or create a service
```

### Connect GitHub
- Install the Railway GitHub App on your repo via Railway dashboard → Project → Settings → GitHub
- Railway auto-deploys on push to the configured branch

### First Deploy
```bash
railway up
```

## Rate Limiting

Unlike serverless platforms, Railway runs persistent processes — in-memory rate limiting works correctly. Use a simple counter map (e.g., `Map<string, number[]>`) for auth and payment API routes.

For high-traffic production use, consider Redis-based rate limiting via a Railway Redis add-on.

## Patterns
- Railway auto-deploys when GitHub integration is connected and code is pushed to `main`
- The app must listen on `process.env.PORT` — Railway assigns the port dynamically
- Use Nixpacks for zero-config deploys; add a Dockerfile only when customization is needed
- Environment variables are configured in Railway dashboard or via CLI
- Health check endpoint at `/api/health` is verified by Railway after each deploy
- In-memory rate limiting works on Railway (persistent process, not serverless)

## PR Instructions
- After merging: create a project at [railway.app](https://railway.app), connect your GitHub repo, and add environment variables in the Railway dashboard. Note: `/deploy` currently only automates Vercel hosting — for Railway, use the CLI (`railway up`) or the dashboard.
- Railway auto-deploys on every push to `main` when GitHub integration is connected
