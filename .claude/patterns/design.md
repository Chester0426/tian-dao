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

Every page must look **professionally designed** — visually equivalent to
a funded startup's production UI. Not a template. Not "adequate." Each page
should make the founder proud. This standard applies equally to all pages,
but expresses differently based on page purpose.

**Landing page** (marketing surface) — optimized for **persuasion**.
The benchmark is a $50K agency landing page:
- Custom color palette (not default shadcn/tailwind colors)
- Considered typography (display + body font, clear hierarchy)
- Meaningful animations (scroll-triggered reveals, staggered transitions)
- Textured depth (subtle gradients, noise overlays, backdrop effects)
- Responsive layout, dark/light mode
- The goal: "I want to share this URL"

**Inner pages** (product surface) — optimized for **utility**.
The benchmark is a top-tier SaaS product (Linear, Vercel, Raycast):
- Same custom palette and typography as landing (visual coherence)
- Proper spacing rhythm (consistent padding, margins, gap)
- Information hierarchy (scannable layout, appropriate data density)
- Interaction quality (loading states, empty states, hover/focus feedback)
- Component completeness (all shadcn/ui, no raw HTML, proper form validation)
- Functional animations (skeleton loaders, micro-interactions, state transitions)
- The goal: "I want to use this tool every day"

Both expressions share the same theme tokens. Neither is a lower bar —
they are different axes of the same professional standard.

When `frontend-design` is available, invoke it for all pages (with
context-appropriate creative brief). When unavailable, follow the theme
tokens and the relevant expression criteria.

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

Skills decide when and how to invoke `frontend-design`. Scan-only subagents
(e.g., `visual-scanner`) cannot invoke skills, but fixer subagents
(e.g., `visual-fixer`) can — `visual-fixer` has `frontend-design` preloaded
via its `skills` field. When `frontend-design` is unavailable, the creative
brief and constraints provide sufficient direction.

### Theme contract

- Record choices in the theme layer (globals.css custom properties,
  tailwind config, font setup in layout.tsx)
- All pages consume these tokens — no per-page color/font overrides
- `/change` must preserve these choices unless explicitly asked to restyle
