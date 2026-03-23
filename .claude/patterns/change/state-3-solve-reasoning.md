# STATE 3: SOLVE_REASONING

**PRECONDITIONS:**
- Context read (STATE 2 POSTCONDITIONS met)
- Preliminary classification determined from `$ARGUMENTS` keywords

**ACTIONS:**

Before classifying the change, run a structured solution design pass using
`.claude/patterns/solve-reasoning.md` with adaptive depth.

### Complexity assessment

Determine solve-reasoning depth using the preliminary classification from Step 2:

```
solve_depth = "light"  # default
if preliminary_type in [Feature, Upgrade] AND affected_areas >= 3:
    solve_depth = "full"
if $ARGUMENTS contains "--light":
    solve_depth = "light"  # user override
if $ARGUMENTS contains "--full":
    solve_depth = "full"   # user override
```

State the depth selection with rationale. If the formula selects "full" but the affected
areas appear independent (no shared state, no shared imports), suggest to the user:
"3+ affected areas trigger full mode, but these areas look independent. Re-run with
`--light` if you want to skip deep analysis."

### Light mode path

Call `.claude/patterns/solve-reasoning.md` light mode (Steps 1-5).

- **Inputs**: `$ARGUMENTS` as problem, exploration results from Step 2 as constraints
- **Output**: stored in working memory, feeds into plan "How" sections in Phase 1

### Full mode path

Call `.claude/patterns/solve-reasoning.md` full mode (Phases 1-6).

- **Phase 1 agent customization**:
  - Agent 1 = change problem space (what needs to change, for whom, and why)
  - Agent 2 = reuse/prior art (extends plan-exploration — find existing patterns, components, utilities that partially solve this)
  - Agent 3 = hard constraints (archetype restrictions, stack limitations, behavior scope from experiment.yaml)
- **Phase 3 questions**: HELD — merged into the Phase 1 STOP gate (see below)
- **Phase 5 Critic**: reviews plan mechanism choices (no extra domain vectors)
- **Output feeds**:
  - "Recommended Solution" + "Implementation Checklist" -> plan "How" sections
  - "Remaining Risks" -> Risks & Mitigations section
  - "Alternatives" -> Approaches table (if multi-layer Feature)
  - "Constraint Space" -> informs Step 3 classification and Step 4 prerequisite checks

**POSTCONDITIONS:**
- `solve_depth` determined and stated with rationale
- Solve-reasoning pass completed (light or full)
- Output stored in working memory for plan generation

**VERIFY:**
```bash
echo "Solve-reasoning complete — depth: [light|full]"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh change 3
```

**NEXT:** Read [state-4-classify.md](state-4-classify.md) to continue.
