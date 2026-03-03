# Visual Review Procedure

Screenshot all pages and review them for visual issues that compile-time
checks miss: broken layout, missing fonts, wrong colors, empty pages.

> Requires Playwright. Skips automatically when not installed.

## 1. Prerequisite Check

Run `npx playwright --version`. If it fails (not installed), skip this
entire procedure with the message:

> Skipping visual review — Playwright not installed.

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
