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

One display font + one body font maximum. Choose fonts that match the product's domain and tone. Load via `next/font/google` (zero-dependency, ships with Next.js). The frontend-design plugin will select distinctive, characterful fonts — accept its choices unless they conflict with readability at small sizes (body text below 14px).

Anti-pattern: do NOT use more than two fonts total, or import font files manually.

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

Anti-pattern: do NOT add animation tokens or complex shadow scales beyond what the frontend-design plugin generates. Custom gradients and accent shadows are acceptable when the plugin recommends them as part of a cohesive aesthetic — but keep them in CSS custom properties, not inline styles. Rule 4 still applies to animation: no motion libraries or JS-driven animations.

## Section C: Page-Level Conventions

Specific Tailwind classes per page type — mobile-first:

| Page type | Mobile (default) | Desktop override |
|-----------|-----------------|------------------|
| Landing hero | `py-16 px-4 text-center` | `md:py-32 md:px-6` |
| Landing sections | `py-12 px-4`, `max-w-5xl mx-auto` | `sm:px-6 sm:py-16` |
| Auth pages | `min-h-screen flex items-center justify-center px-4`, card `w-full max-w-md` | (no override needed) |
| App pages | `max-w-5xl mx-auto px-4 py-6`, heading `mb-4` | `sm:py-8 sm:mb-6` |

> Mobile is the base. Desktop classes use `sm:` / `md:` prefixes. Never write mobile styles with a breakpoint prefix — that inverts the cascade.

These constraints prevent the "full-viewport text wall" anti-pattern while keeping layout simple.

### Grid Layout for Feature / Benefit Cards

- `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`
- Single column on mobile → 2-col on tablet → 3-col on desktop
- Anti-pattern: do NOT use `flex flex-wrap` for card grids — inconsistent widths on odd counts.

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

### Touch Targets

- Primary CTA on mobile: add `w-full sm:w-auto` — full-width on small screens, auto on desktop
- Minimum interactive element height: `h-11` (44px) on mobile — matches Apple HIG minimum tap target
- Spacing between stacked interactive elements: `gap-3` minimum — prevent mis-taps

### Form Inputs

- All `<Input>` and `<Select>` elements: `text-base` (16px) — prevents iOS Safari auto-zoom on focus (triggered at < 16px)
- Input height: `h-11` on mobile for comfortable tap targets
- Stack form fields vertically on mobile (`space-y-4`), side-by-side only at `sm:` and above

### Cards

Use `<Card>` with proper sub-components (`CardHeader`, `CardTitle`, `CardContent`) — never raw `<div>` with manual borders.

Anti-pattern: do NOT wrap the entire page in a single `<Card>`. Cards are for discrete content units (feature cards, pricing tiers, form containers).

Anti-pattern: do NOT add hamburger menus, bottom navigation bars, swipe gestures, or app-shell chrome. MVPs have few pages — a simple inline nav or single CTA per page is sufficient.

## Section E: Frontend-Design Plugin Coordination

This template enables the Anthropic `frontend-design` plugin, which auto-activates during frontend work and pushes toward distinctive aesthetics. This section defines how design.md and the plugin coexist.

### Priority Rules

When the plugin's guidance conflicts with this file:

1. **Aesthetic decisions — plugin wins.** Font selection, color palette, visual atmosphere (gradients, textures, shadows), and theme direction are the plugin's domain.

2. **Structural decisions — design.md wins.** Layout grids (Section C), responsive breakpoints, max-width constraints, component sizing (Section D), touch targets, and spacing scales are non-negotiable. Do NOT apply asymmetric layouts, grid-breaking elements, or diagonal flow the plugin may suggest.

3. **Minimalism gate — Rule 4 wins.** If the plugin suggests JS animation libraries (Framer Motion, GSAP), scroll-triggered effects, custom cursors, or any runtime dependency not in idea.yaml `stack` — skip it. CSS-only transitions and `@keyframes` animations are fine.

### What the plugin controls

- Font family selection (display + body, loaded via `next/font/google`)
- Primary and accent color palette (overrides Section A hue table and Section B `--primary`)
- Background treatment (solid, gradient, texture — via CSS custom properties)
- Light vs dark theme direction
- Micro-interactions using CSS transitions only

### What design.md controls (plugin must NOT override)

- Page layout structure (Section C tables)
- Grid system: `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`
- Max-width constraints: `max-w-5xl mx-auto`
- Mobile-first responsive approach
- Component library: shadcn/ui components only
- Typography scale classes (Section D)
- Touch targets: `h-11` minimum, `gap-3` spacing
- Form input sizing: `text-base` (16px) to prevent iOS auto-zoom

### Anti-patterns with the plugin active

- Do NOT apply "asymmetric layout" or "grid-breaking" suggestions — use Section C grids
- Do NOT add noise textures, grain overlays, or custom cursors
- Do NOT import framer-motion or any animation library — CSS transitions only
- Do NOT override Section D component sizing for aesthetic effect
