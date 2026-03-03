# Visual Design System

## Quality Invariants

Two non-negotiable rules that prevent real usability issues:

1. **Form input sizing**: All `<Input>` and `<Select>` elements must use `text-base` (16px minimum). This prevents iOS Safari from auto-zooming the viewport when a user focuses an input field (triggered at font sizes below 16px). This is a platform bug workaround, not an aesthetic choice.

2. **Use shadcn/ui components**: Use library components (`<Button>`, `<Input>`, `<Card>`, etc.) instead of raw HTML elements. This ensures accessibility baselines (ARIA attributes, keyboard handling, focus management) without manual effort.

## Aesthetic Direction

Create a distinctive, polished visual identity that matches the product domain and target user. Choose fonts, colors, layout, spacing, and animation that feel intentional — not generic or template-like. The only constraints are the quality invariants above.

## `/change` Consistency

When modifying an existing app (not bootstrapping), read the existing pages first and maintain visual consistency with the established design direction. Do not introduce a new visual style mid-project.
