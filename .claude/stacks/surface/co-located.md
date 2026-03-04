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

# Co-located Surface

The acquisition surface lives within the product deployment — same server,
same domain, same deploy pipeline.

## web-app

No additional work. The landing page IS the surface. `visit_landing` is
already wired by the standard funnel in EVENTS.yaml. `frontend-design`
already designs it.

## service

Create a root route handler (`GET /`) that returns a complete HTML marketing
page. The route path depends on the framework stack file (e.g.,
`src/app/route.ts` for Next.js, root handler in entry point for Hono).

The HTML is NOT templated — `frontend-design` creates a fully custom page
per experiment.

**Content sources from idea.yaml:**
- `name` → page title
- `title` → headline
- `solution` → subheadline
- `features` → feature showcase
- CTA → API docs link or first endpoint

**Inline PostHog snippet:** Embed a `<script>` tag to fire `visit_landing`
with UTM properties on page load (read PostHog project API key from the
analytics stack file's hardcoded value).

**CSS:** Inline `<style>` — no build step, no framework dependency.

## Quality bar

Same as web-app landing pages. `frontend-design` has full creative authority
— custom color palette, typography (Google Fonts via `<link>`), animations
(CSS keyframes), responsive layout, dark/light mode
(`prefers-color-scheme`). Not a template — a unique page that matches the
product domain.

## Analytics wiring

The inline PostHog snippet captures `visit_landing` with:
- `referrer`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- `click_id`
- Global properties: `project_name`, `project_owner`
