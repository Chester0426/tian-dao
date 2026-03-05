# Scaffold: Visual Design Foundation

This procedure is executed by the `scaffold-init` agent spawned by `/bootstrap`.
As an independent Claude Code session, you have full access to project
files, tools (LSP if available), and file system.

## Scope

Execute design decisions only — set the visual tone, theme tokens, and
visual brief. Package installation, framework config, and UI setup are
already complete (handled by the `scaffold-setup` agent). Library files,
pages, external dependencies, landing page, and wiring are handled by
separate subagents.

## Prerequisites
- Branch already created (by bootstrap Step 0)
- Plan approved and saved to `.claude/current-plan.md`
- Packages installed and UI framework configured (by scaffold-setup agent)
- Read all context files listed in your task assignment before starting

## Steps

### Step 1: Design decisions
1. Derive the three design constraints per `.claude/patterns/design.md` (color direction, design philosophy, optimization target) from idea.yaml's product domain.
2. Apply the preloaded `frontend-design` guidelines (injected via skills)
   for visual direction within the derived constraints. If not available,
   use your own judgment — match the product's personality, not framework defaults.
3. Record choices in globals.css custom properties and tailwind config per the theme contract in design.md. Font setup applies when layout.tsx is created by the pages subagent.
4. Write `.claude/current-visual-brief.md` — a structured brief that all page-generating subagents will read for visual coherence. Sections:
   - **Design Constraints**: the 3 constraints derived above (color direction, design philosophy, optimization target)
   - **Color Palette**: primary, accent, background treatment, dark mode approach
   - **Typography**: display font, body font, scale
   - **Animation & Motion**: philosophy (e.g., subtle/energetic), scroll effects, micro-interactions, loading states
   - **Spacing & Density**: overall density, section spacing, card spacing
   - **Component Style**: border radius, shadows, borders, button style
   - **Visual Texture**: decorative elements, background patterns, depth technique

## Completion Report

When done, report:
1. Design decisions: color direction, design philosophy, optimization target
2. Theme tokens written (globals.css custom properties, tailwind config)
3. Visual language brief written to `.claude/current-visual-brief.md`
4. Issues encountered (if any)
