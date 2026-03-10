---
description: "Web application with browser-based pages, UI components, and user authentication"
required_stacks: [framework, hosting]
optional_stacks: [database, auth, analytics, ui, payment, email, testing]
excluded_stacks: []
required_idea_fields: [pages]
build_command: "npm run build"
funnel_template: web
---

# Web App Archetype

Browser-based application with URL-routed pages, UI components, and optional
user authentication. This is the default archetype when `type` is absent from
experiment.yaml.

## Structure

Each experiment.yaml `pages` entry maps to a route folder:

```
src/app/<page-name>/page.tsx
```

Pages are React components rendered in the browser. The landing page
(`pages` must include an entry with `name: landing`) is the public entry point.

## Funnel

Standard web funnel defined in EVENTS.yaml:
The landing page serves as both the product entry point and the acquisition
surface — `visit_landing` fires here.

1. `visit_landing` — user loads the landing page
2. `signup_start` — user begins the signup flow
3. `signup_complete` — user finishes signup
4. `activate` — user completes the core action for the first time
5. `retain_return` — user returns after initial activation

Payment funnel events (`pay_start`, `pay_success`) are added when
`stack.payment` is present in experiment.yaml.

## Conventions

- Every page fires analytics events per EVENTS.yaml
- Landing page is required — `validate-idea.py` enforces this
- UI components come from the configured UI stack (e.g., shadcn/ui)
- API routes live under `src/app/api/` for mutations and server-side logic
- Database access uses RLS (Row-Level Security) when auth is configured
