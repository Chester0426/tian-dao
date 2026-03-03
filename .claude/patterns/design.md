# Visual Design System

## Quality Invariants

Two non-negotiable rules that prevent real usability issues:

1. **Form input sizing**: All `<Input>` and `<Select>` elements must use `text-base` (16px minimum). This prevents iOS Safari from auto-zooming the viewport when a user focuses an input field (triggered at font sizes below 16px). This is a platform bug workaround, not an aesthetic choice.

2. **Use shadcn/ui components**: Use library components (`<Button>`, `<Input>`, `<Card>`, etc.) instead of raw HTML elements. This ensures accessibility baselines (ARIA attributes, keyboard handling, focus management) without manual effort.

## Frontend-Design Plugin

The frontend-design plugin has **full authority** over all aesthetic and structural visual decisions:

- **Layout**: page structure, grid systems, content arrangement, information architecture
- **Color**: palette, primary/accent colors, gradients, backgrounds
- **Typography**: font selection, scale, weight, spacing
- **Spacing**: margins, padding, gaps, section sizing
- **Animation**: CSS transitions, keyframes, and Framer Motion (included in UI stack)
- **Atmosphere**: shadows, borders, textures, visual treatments

The plugin's choices create the product's visual identity. Accept them fully — the only constraints are the two quality invariants above.

## When No Plugin Guidance Is Available

Use your best judgment based on the product domain. Choose fonts, colors, layout, and spacing that feel appropriate for the target user and product category. There are no default hue tables or prescribed Tailwind classes — create a distinctive look that matches the product.

## `/change` Consistency

When modifying an existing app (not bootstrapping), read the existing pages first and maintain visual consistency with the established design direction. Do not introduce a new visual style mid-project.
