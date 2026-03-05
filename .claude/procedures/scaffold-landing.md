# Scaffold: Landing Page

This procedure is executed by the `scaffold-landing` agent spawned by `/bootstrap`.
As an independent Claude Code session, you have full access to project
files, tools (LSP if available), and file system.

## Prerequisites
- Branch already created (by bootstrap Step 0)
- Step 1 complete (theme tokens in `src/app/globals.css`, visual brief at `.claude/current-visual-brief.md`)
- `.claude/current-plan.md` exists

## Instructions

Resolve the surface type: if `stack.surface` is set in idea.yaml, use it.
Otherwise infer: `stack.hosting` present → `co-located`; absent → `detached`.
Read the surface stack file at `.claude/stacks/surface/<value>.md`.

- **surface: none**: report "surface: none — no landing page needed" and stop.

**All other cases**: generate a world-class landing page.

### 1. Design decisions

Read the visual language brief from `.claude/current-visual-brief.md`. Do NOT
re-derive constraints — the brief contains the canonical design decisions
(color direction, philosophy, optimization target, palette, typography,
animation, spacing, component style, and texture). Also read the theme tokens
from `src/app/globals.css` and tailwind config (already set in Step 1).

### 2. Apply frontend-design methodology

Apply the preloaded `frontend-design` guidelines (injected via skills) with:
- The three derived constraints
- The quality bar from design.md: "Create a world-class, conversion-optimized
  landing page. The visual quality must match a $50K agency page — not
  adequate, exceptional."
- The full content of idea.yaml (product context)
- Copy derivation rules from messaging.md Section A (headline = outcome for
  target_user, CTA = action verb + outcome)
- Content inventory from messaging.md Section B (raw material, not structure)

If `frontend-design` guidelines are not available: use your own judgment —
match the product's personality, follow design.md quality bar, and apply
messaging.md content derivation rules. Do not stop or wait.

### 3. Generate the page

Use the frontend-design output to build the landing page. Technical context
varies by archetype:

**web-app + co-located** (React component):
- Include: theme tokens (globals.css custom properties, tailwind config from
  Step 1), available shadcn/ui components, framework page conventions from
  framework stack file. Derive analytics function signatures from EVENTS.yaml —
  the `src/lib/events.ts` file will exist at build time (created by the libs
  subagent running in parallel)
- If no `variants`: write `src/app/page.tsx` — a complete React landing
  page component. Must fire `visit_landing` on mount with EVENTS.yaml properties.
- If `variants`: write `src/components/landing-content.tsx` — a shared
  `LandingContent` component that accepts variant props (headline, subheadline,
  cta, pain_points). Features section is shared across variants (from idea.yaml
  `features`). The structural routing files (variants.ts, root page, dynamic
  route) are created by the pages subagent running in parallel — they will
  exist at build time.

**service + co-located** (self-contained HTML):
- Include: surface stack file content (route path, analytics wiring, CSS approach)
- Write the route handler file at [path from framework stack file]
  returning a complete self-contained HTML page

**cli + detached** (self-contained HTML):
- Include: surface stack file content (file path, CSS approach)
- Write `site/index.html` as a complete self-contained HTML page

### 4. Wire analytics

If `stack.analytics` is present and not already included:
- For web-app: verify event imports and tracking calls exist
- For service/cli: add inline snippet per surface stack file's analytics section

### 4b. Self-review

- Screenshot the landing page you just generated (follow `.claude/patterns/visual-review.md` for server setup)
- Review per-section: is there ANY section you'd rate below 8/10?
- If yes, rewrite it now — don't leave it for the verify phase

### 5. Build verification

- Run `npm run build` to verify the landing page compiles (web-app only)
- If build fails: fix errors, re-run (1 attempt budget)

## Output

Report:
1. Surface type resolved
2. Landing page file(s) created
3. Analytics wiring status
4. Build result (pass/fail)
