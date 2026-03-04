# Visual Design System

## Quality Invariants

Two non-negotiable rules that prevent real usability issues:

1. **Form input sizing**: All `<Input>` and `<Select>` elements must use `text-base` (16px minimum). This prevents iOS Safari from auto-zooming the viewport when a user focuses an input field (triggered at font sizes below 16px). This is a platform bug workaround, not an aesthetic choice.

2. **Use shadcn/ui components**: Use library components (`<Button>`, `<Input>`, `<Card>`, etc.) instead of raw HTML elements. This ensures accessibility baselines (ARIA attributes, keyboard handling, focus management) without manual effort.

## Design Decisions

Before generating pages, make all visual design decisions based on the
product domain in idea.yaml. The frontend-design plugin has full authority
over what to decide and how. If the plugin is not enabled, use your own
judgment — match the product's personality, not framework defaults.

Output contract:
- Record choices in the theme layer (globals.css custom properties,
  tailwind config, font setup in layout.tsx)
- All pages consume these tokens — no per-page color/font overrides
- `/change` must preserve these choices unless explicitly asked to restyle
