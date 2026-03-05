# Visual Review Procedure

Screenshot all pages and review them for visual issues that compile-time
checks miss: broken layout, missing fonts, wrong colors, empty pages.

> Requires Playwright. Skips automatically when not installed.

## 1. Prerequisite Check

Run `npx playwright --version`. If it fails (not installed), skip this
entire procedure with the message:

> Skipping visual review — Playwright not installed.

## 1b. Ensure client env vars for rendering

If `.env.example` contains `NEXT_PUBLIC_*` variables and `.env.local`
does not exist, the build has inlined `undefined` values — pages will
crash at runtime. Rebuild with safe placeholder values:

```bash
if grep -q 'NEXT_PUBLIC_' .env.example 2>/dev/null && [ ! -f .env.local ]; then
  grep 'NEXT_PUBLIC_' .env.example | sed 's/=.*/=placeholder/' > /tmp/.env.visual-review
  set -a && . /tmp/.env.visual-review && set +a && npm run build
  rm /tmp/.env.visual-review
fi
```

This rebuild is for visual review only — it is not committed.

## 2. Start Production Server

The build has already passed at this point. Start a production server on a
non-conflicting port:

```bash
npm run start -- -p 3099 &
```

Poll `http://localhost:3099` until it responds (max 15 seconds, then abort).

## 3. Screenshot All Pages

Read `idea/idea.yaml` to get the list of pages and their routes. Write a
small inline Node.js script that uses the Playwright API to:

- Launch a Chromium browser (headless)
- Visit each route at `http://localhost:3099`
- Wait for network idle
- Take a full-page screenshot at 1280x800 viewport
- Save each screenshot to `/tmp/visual-review/<page-name>.png`

Run the script with `node`.

## 4. Review Each Screenshot

Use the Read tool to view each screenshot image. For every page, check:

- **Fonts loaded** — text uses the intended font, not a system fallback
- **Colors applied** — not default unstyled gray; matches design intent
- **Layout intact** — no overlapping elements, no unexpected blank areas
- **Content renders** — page shows real content or plausible placeholder,
  not an error state or empty white page
- **Above-the-fold quality** — the visible area looks polished, not
  obviously broken or template-like

## 4b. Design Quality Gate (all pages)

Every page is evaluated against the professional design standard from
`.claude/patterns/design.md`. The checklist differs by page purpose, but
the rigor and verdict scale are identical.

### Landing page (`/` route) — persuasion checklist

1. **Color direction** — Does the palette match the derived direction (dark/light/neutral)?
2. **Design philosophy** — Does the density and ornamentation match (minimalist/rich/playful)?
3. **Optimization target** — Is the layout optimized for the right goal (conversion/documentation/demonstration)?
4. **Custom palette** — not default shadcn/tailwind colors?
5. **Typography** — display + body font, clear hierarchy?
6. **Visual depth** — meaningful animations, gradients, shadows, transitions?
7. **Above-the-fold** — polished composition that invites engagement?

### Inner pages (all non-landing) — utility checklist

1. **Visual coherence** — same custom palette and typography as landing page?
2. **Spacing rhythm** — consistent padding, margins, gaps (not random)?
3. **Information hierarchy** — scannable layout, appropriate data density for page purpose?
4. **Interaction quality** — loading states, empty states, hover/focus feedback present?
5. **Component completeness** — shadcn/ui components, no raw HTML, proper form validation?
6. **Functional animations** — skeleton loaders, state transitions (not static jumps)?
7. **Layout purpose** — clear hierarchy, intentional composition (not just stacked elements)?

### Layer 3: Anti-pattern Rejection

Any of these triggers automatic `needs-polish` verdict:
- Landing page's only animation technique is fade-in / slide-up
- All sections use the same centered-column layout pattern
- Hero is plain text + button with no interactive element
- All Card, Button, Badge components use unmodified shadcn default styling (no project-specific shadows, borders, gradients, or animation)
- Page scroll produces no visual events (no color shifts, layout changes, or animations between sections)

> These catch the most common mediocrity patterns. A page can pass Layer 2
> checks individually but still fail Layer 3 if the overall impression is generic.

### Verdicts (same scale for both)

- **pass** — meets the professional standard for its page type, no action needed
- **needs-polish** — below the professional standard. Report specific gaps
  (e.g., landing: "no visual depth or animations"; inner: "no loading states,
  raw HTML inputs"). Enter Fix Cycle in Step 5.
- **fail** — fundamentally broken design (wrong direction entirely, or
  completely unstyled). Enter Fix Cycle.

## 5. Fix Cycle (max 2 cycles)

If visual issues are found:

1. Fix the code
2. Run `npm run build` (must still pass)
3. Re-screenshot the affected pages
4. Re-review

Repeat up to **2 fix cycles**. If issues remain after 2 cycles, report
them to the user and proceed — do not block the commit.

## 6. Cleanup

Kill the production server and remove the temporary screenshots:

```bash
kill %1 2>/dev/null || true
rm -rf /tmp/visual-review
```
