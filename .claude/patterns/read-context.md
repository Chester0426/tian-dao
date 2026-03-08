# Read Context Pattern

Every skill reads this baseline context before executing its specific logic.

## Required Context (always read)
1. `idea/idea.yaml` — single source of truth (scope, features, stack, metrics)
2. `EVENTS.yaml` — canonical analytics event list
3. Archetype file at `.claude/archetypes/<type>.md` (type from idea.yaml, default `web-app`)

## Stack Context (read when `stack_categories` in skill frontmatter includes the category)
For each category in idea.yaml `stack`:
- Read `.claude/stacks/<category>/<value>.md`

## Optional Context (read if file exists)
- `.claude/current-plan.md` — persisted plan from previous session
- `.claude/iterate-manifest.json` — analysis from last /iterate run
- `.claude/deploy-manifest.json` — resources from last /deploy run
- `idea/on-touch.yaml` — modules deferred for hardening

## How to Reference
Skills should say: "Read context per `.claude/patterns/read-context.md`" instead of
listing individual files. Type-specific context (e.g., deploy reads .env.example,
change reads src/app/) is documented in the skill itself.
