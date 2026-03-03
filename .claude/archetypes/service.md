---
description: "Backend service with API endpoints, no browser UI"
required_stacks: [framework, hosting]
optional_stacks: [database, auth, analytics, payment, email, testing]
excluded_stacks: [ui]
required_idea_fields: [endpoints]
build_command: "npm run build"
funnel_template: custom
---

# Service Archetype

Backend service that handles API requests with no browser-based UI.
The primary unit of work is the **endpoint** (not the page). Use this
archetype when `type: service` is set in idea.yaml.

## Structure

Each idea.yaml `endpoints` entry maps to an API route:

```
src/app/api/<endpoint>/route.ts
```

There are no page folders, no landing page, no UI components, and no
`src/components/` directory. The `ui` stack category is excluded.

## Funnel

Services use `funnel_template: custom` — there is no standard web funnel.
The standard web events (`visit_landing`, `signup_start`, `signup_complete`)
do not apply. Instead, define experiment-specific events in EVENTS.yaml
`custom_events`.

Typical service events (suggestions, not requirements):

1. `api_call` — a request hits an endpoint
2. `activate` — user completes the core action via the API
3. `retain_return` — user makes a request after 24+ hours since last call

All service events use `trackServerEvent()` from the server analytics library.

## Testing

Services use unit and API tests (e.g., Vitest, Jest), not browser-based
E2E tests (Playwright). The test runner comes from the testing stack file.

## Deploy

Deployment follows the hosting stack file. For services, browser-based
health checks don't apply — use the `/api/health` endpoint instead.

## Conventions

- Every endpoint fires analytics events per EVENTS.yaml (server-side)
- No landing page requirement — `validate-idea.py` skips landing checks
- No UI components — the `ui` stack category is excluded
- Database access uses RLS (Row-Level Security) when auth is configured
- API routes live directly under `src/app/api/`
