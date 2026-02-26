# Visual Design System

Shared visual rules for generated MVPs. Every MVP should look like "an early-stage SaaS product built by a small, design-conscious team" — trustworthy enough that users engage honestly with the experiment.

## Section A: Visual Identity Rules

Three anti-patterns to eliminate:
1. **Gray-on-gray hero** with default shadcn slate primary — every MVP looks identical
2. **No max-width constraint** on content — text spans full viewport, feels like dev mode
3. **Default component sizing everywhere** — tiny buttons in hero, no visual hierarchy

### One-Decision Principle

Derive the primary hue from the product domain:
- Invoicing / productivity → slate-blue
- Fitness / health → green
- Finance / fintech → indigo
- Education → amber
- Social / community → violet

Fallback (when the domain has no obvious hue): `hsl(221, 83%, 53%)` — professional blue.

One font: **Inter** via `next/font/google` (zero-dependency, ships with Next.js).

Anti-pattern: do NOT pick multiple fonts, add decorative typefaces, or import font files manually.

## Section B: Theme Defaults

After `shadcn init`, override these CSS custom properties in `globals.css`:

```css
/* In :root block — after shadcn-generated values */
--primary: 221 83% 53%;           /* or domain-appropriate hue */
--primary-foreground: 0 0% 100%;
--radius: 0.5rem;
```

Match the `.dark` block with a lighter primary variant if dark mode is present.

Derive `--primary` from idea.yaml's domain when possible (see Section A hue table). When the domain is ambiguous, use the blue fallback.

Anti-pattern: do NOT add custom gradients, animation tokens, or shadow scales. Rule 4 applies — ship the simplest thing that works.

## Section C: Page-Level Conventions

Specific Tailwind classes per page type:

| Page type | Key rules |
|-----------|-----------|
| Landing hero | `py-24 md:py-32`, `max-w-3xl mx-auto text-center` |
| Landing sections | `max-w-5xl mx-auto px-4 sm:px-6`, `py-16` between sections |
| Auth pages | `min-h-screen flex items-center justify-center`, card `max-w-md` |
| App pages | `max-w-5xl mx-auto px-4 py-8`, heading `mb-6` |

These constraints prevent the "full-viewport text wall" anti-pattern while keeping layout simple.

## Section D: Component Conventions

### Typography Scale

| Element | Classes |
|---------|---------|
| Hero headline | `text-4xl md:text-5xl font-bold tracking-tight` |
| Subheadline | `text-xl text-muted-foreground` |
| Section heading | `text-2xl font-semibold` |
| Body | `text-base` |

Use `text-base` explicitly for body text — prevent agents defaulting to `text-sm`.

### Button Sizing

- Primary CTA in hero / CTA-repeat: `<Button size="lg">` — always large
- Secondary actions: `<Button variant="outline">`
- In-page actions (forms, cards): default size is fine

### Cards

Use `<Card>` with proper sub-components (`CardHeader`, `CardTitle`, `CardContent`) — never raw `<div>` with manual borders.

Anti-pattern: do NOT wrap the entire page in a single `<Card>`. Cards are for discrete content units (feature cards, pricing tiers, form containers).
