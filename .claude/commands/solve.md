---
description: "First-principles analysis to find the strongest solution. Use for architectural decisions, complex tradeoffs, and non-obvious problems."
type: analysis-only
reads: []
stack_categories: []
requires_approval: true
references:
  - .claude/patterns/solve-reasoning.md
branch_prefix: ""
modifies_specs: false
---

Find the optimal solution to a problem using first-principles analysis, structured
research, constraint enumeration, self-critique, and convergence.

## Input

Read the problem statement from the user's arguments: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask the user to describe the problem.

## Depth Selection

- Default: `full` (4 Opus agents, ~3 min)
- If user includes `--light` or `--quick` in arguments: use `light` mode (~30s, 0 agents)
- If user includes `--full` in arguments: use `full` mode

## Execution

Follow `.claude/patterns/solve-reasoning.md` using the selected depth mode.

Pass the problem statement verbatim — do not reinterpret or narrow it.

## Output

Present the output exactly as specified in solve-reasoning.md Phase 6 (full mode)
or Step 5 (light mode).

## STOP

After presenting the output, **STOP**. Do not implement anything.

The user decides next steps:
- Implement manually
- Run `/change` with the recommendation
- Ask follow-up questions
- Reject and re-run with different constraints
