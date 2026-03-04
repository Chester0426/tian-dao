# Visual Design System

## Quality Invariants

Two non-negotiable rules that prevent real usability issues:

1. **Form input sizing**: All `<Input>` and `<Select>` elements must use `text-base` (16px minimum). This prevents iOS Safari from auto-zooming the viewport when a user focuses an input field (triggered at font sizes below 16px). This is a platform bug workaround, not an aesthetic choice.

2. **Use shadcn/ui components**: Use library components (`<Button>`, `<Input>`, `<Card>`, etc.) instead of raw HTML elements. This ensures accessibility baselines (ARIA attributes, keyboard handling, focus management) without manual effort.

## Design Decisions

Before generating pages, derive design constraints from idea.yaml and establish
visual direction. `frontend-design` is the recommended executor for visual
decisions (see `### Recommended executor`); skills decide when and how to
invoke it.

> Skip this section if `stack.surface` resolves to `none`.
> (Inference: `stack.hosting` present → `co-located`; absent → `detached`.
> Explicit `stack.surface` in idea.yaml overrides inference.)

### Design constraints

Three hard constraints must be derived from idea.yaml's product domain before
any visual decisions are made. These compress ~100 open decisions to ~10:

1. **Color direction** — dark, light, or neutral. Infer from product domain
   (e.g., security/dev-tools/AI → dark; consumer/health/education → light;
   B2B/finance → neutral). The executor may override with justification.
2. **Design philosophy** — minimalist, rich, or playful. Infer from audience
   (developers → minimalist; consumers → rich; creative → playful).
3. **Optimization target** — conversion, documentation, or demonstration.
   Infer from archetype and funnel (web-app with waitlist → conversion;
   service with API → documentation; CLI → demonstration).

These constraints, along with idea.yaml content, are inputs to the visual
executor.

### Quality bar

The landing page is the first thing a potential user sees. It must be
**world-class** — visually equivalent to a $50K agency landing page.

The expectation is not "use nice colors." The expectation is: custom color
palette, considered typography, meaningful animations (scroll-triggered
reveals, staggered transitions), textured depth (subtle gradients, noise
overlays, backdrop effects), responsive layout, dark/light mode.

Not a template. Not adequate. Exceptional — a unique page that makes the
founder proud to share the URL. This standard applies to ALL archetypes:
web-app (React component), service (HTML route), and CLI (HTML file).

### Recommended executor

The `frontend-design` skill is the recommended executor for all visual
decisions. It has full authority over visual direction — color palette,
typography, spacing, component styling, and layout composition — within the
derived constraints.

For **service/cli archetypes with a surface**: the executor creates a complete,
self-contained HTML marketing page (not a React component). CSS is inline,
fonts via Google Fonts `<link>`, animations via CSS keyframes. Same creative
authority as for web-app — unique visual identity per experiment, not a
generic template.

Skills decide when and how to invoke `frontend-design`. If the skill is not
available in a given context (e.g., inside a subagent), the creative brief
and constraints provide sufficient direction.

### Theme contract

- Record choices in the theme layer (globals.css custom properties,
  tailwind config, font setup in layout.tsx)
- All pages consume these tokens — no per-page color/font overrides
- `/change` must preserve these choices unless explicitly asked to restyle
