# Visual Design System

## Quality Invariants

Two non-negotiable rules that prevent real usability issues:

1. **Form input sizing**: All `<Input>` and `<Select>` elements must use `text-base` (16px minimum). This prevents iOS Safari from auto-zooming the viewport when a user focuses an input field (triggered at font sizes below 16px). This is a platform bug workaround, not an aesthetic choice.

2. **Use shadcn/ui components**: Use library components (`<Button>`, `<Input>`, `<Card>`, etc.) instead of raw HTML elements. This ensures accessibility baselines (ARIA attributes, keyboard handling, focus management) without manual effort.

## Design Decisions

Before generating pages, make all visual design decisions based on the
product domain in idea.yaml.

> Skip this section if `stack.surface` resolves to `none`.
> (Inference: `stack.hosting` present → `co-located`; absent → `detached`.
> Explicit `stack.surface` in idea.yaml overrides inference.)

**Invoke the `frontend-design` skill** (via the Skill tool) to make these
decisions. The skill has full authority over visual direction — color
palette, typography, spacing, component styling, and layout composition.

For **service/cli archetypes with a surface**: the skill creates a complete,
self-contained HTML marketing page (not a React component). CSS is inline,
fonts via Google Fonts `<link>`, animations via CSS keyframes. The skill has
the same creative authority as for web-app — unique visual identity per
experiment, not a generic template.

If the skill is not available (not listed in available skills): stop and
tell the user:

> The `frontend-design` plugin is enabled in `.claude/settings.json` but
> did not load in this session. Restart Claude Code to reload plugins.
> If the issue persists, verify
> `"frontend-design@claude-plugins-official": true` is set in
> `.claude/settings.json`.

Then **stop and wait** for the user to confirm it's fixed (or to say
"skip"). If the user says "skip", proceed using your own judgment — match
the product's personality, not framework defaults.

Output contract:
- Record choices in the theme layer (globals.css custom properties,
  tailwind config, font setup in layout.tsx)
- All pages consume these tokens — no per-page color/font overrides
- `/change` must preserve these choices unless explicitly asked to restyle
