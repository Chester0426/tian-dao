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

## 4b. Design Quality Gate (landing page only)

For the landing page screenshot (`/` route), evaluate design quality against
the three constraints from `.claude/patterns/design.md`:

1. **Color direction** — Does the palette match the derived direction (dark/light/neutral)?
2. **Design philosophy** — Does the density and ornamentation match (minimalist/rich/playful)?
3. **Optimization target** — Is the layout optimized for the right goal (conversion/documentation/demonstration)?

Additionally, evaluate the $50K quality bar:
- Custom color palette (not default shadcn/tailwind colors)?
- Considered typography (display + body font, clear hierarchy)?
- Meaningful animations or visual depth (gradients, shadows, transitions)?
- Polished above-the-fold composition?

**Verdict:**
- **pass** — meets quality bar, no action needed
- **needs-polish** — functional but below the $50K bar. Report specific gaps
  (e.g., "using default gray palette", "no visual depth or animations").
  These are treated as visual issues and enter the Fix Cycle in Step 5.
- **fail** — fundamentally broken design (wrong direction entirely). Report
  and enter Fix Cycle.

Skip this step for non-landing pages — they only need the functional checks in Step 4.

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
