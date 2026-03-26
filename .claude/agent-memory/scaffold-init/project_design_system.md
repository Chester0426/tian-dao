---
name: Ink Wash Cultivation Design System
description: Xian Idle uses a 水墨仙風 (ink wash cultivation) design system -- warm ink-black dark palette with cinnabar red primary, jade green accent, spirit gold highlights, Noto Serif SC + Noto Sans SC fonts
type: project
---

Xian Idle's visual identity is the "Ink Wash Cultivation" (水墨仙風) design system, derived from traditional Chinese ink painting materials and cultivation novel aesthetics.

**Why:** The product is a 修仙-themed idle RPG targeting Chinese-literate web3 gamers. The visual language must be culturally authentic (ink wash painting style), atmospheric (mountain/cave cultivation feel), and distinctive from typical web3 game aesthetics (no neon cyberpunk, no pixel art).

**How to apply:**
- Dark-first with warm brown hue angle (~55 oklch) through all surfaces -- never cold blue-grey
- Cinnabar red (`oklch(0.62 0.20 25)` dark / `oklch(0.52 0.19 25)` light) is the primary action color
- Jade green (`oklch(0.65 0.15 160)`) for qi/cultivation energy states
- Spirit gold (`oklch(0.78 0.155 80)`) for breakthroughs and rare drops
- Display font: Noto Serif SC (calligraphic), Body: Noto Sans SC (functional)
- Depth via rice paper noise overlay + ink wash gradient mesh + semantic glow effects
- Custom semantic tokens: cinnabar, jade, spirit-gold, ink-1 through ink-5, xuan, xuan-dark
- All design tokens in `src/app/globals.css`, visual brief at `.claude/current-visual-brief.md`
