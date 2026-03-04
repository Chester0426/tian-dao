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

# Detached Surface

The acquisition surface is deployed independently to Vercel free tier —
separate from the product. Used when the product has no server hosting
(e.g., CLI tools).

## Output

`site/index.html` — a self-contained HTML page. No external CSS/JS files
needed beyond Google Fonts and PostHog CDN.

## Design

Same quality bar as co-located. `frontend-design` has full creative
authority — custom color palette, typography (Google Fonts via `<link>`),
animations (CSS keyframes), responsive layout, dark/light mode
(`prefers-color-scheme`). Not a template — a unique page that matches the
product domain.

**Content from idea.yaml:**
- `name` → page title
- `title` → headline
- `solution` → subheadline
- `features` → feature showcase
- CTA → `npm install -g <name>` command with copy button (pure CSS/minimal JS)

Can include CSS-based terminal animation showing CLI usage.

## Analytics

Same PostHog snippet approach as co-located. Inline `<script>` fires
`visit_landing` on page load with: `referrer`, `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `click_id`, plus global properties
(`project_name`, `project_owner`).

## Deployment

During `/deploy`, run `vercel site/ --prod` to deploy the static site to
Vercel free tier. Bind custom domain (`<name>.<domain>` from `deploy.domain`
if present). Surface URL goes into `deploy-manifest.json` as `surface_url`.

## Note

The CLI archetype excludes `hosting` in its `excluded_stacks`. This does not
apply to the surface — `hosting` exclusion means the PRODUCT has no server
hosting. The surface's Vercel deployment is managed by the surface stack,
not the hosting stack.
