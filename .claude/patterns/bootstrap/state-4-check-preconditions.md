# STATE 4: CHECK_PRECONDITIONS

**PRECONDITIONS:**
- Duplicate check resolved (STATE 3b POSTCONDITIONS met)

**ACTIONS:**

- If `.claude/current-plan.md` exists and the current branch starts with `feat/bootstrap`:
  1. Read `.claude/current-plan.md`. If it has YAML frontmatter (starts with `---`):
     - Parse `archetype`, `stack`, and `checkpoint` from frontmatter
     - Use these values directly — do NOT re-resolve archetype or stack
     - Read archetype file and stack files using frontmatter values
     - Read all files listed in `context_files` to restore source-of-truth context (experiment.yaml, experiment/EVENTS.yaml, etc.). If a listed file no longer exists, skip it and warn the user.
     - Resume at the phase indicated by `checkpoint`:
       - `phase2-setup` -> **jump to STATE 9**
       - `phase2-design` -> **jump to STATE 10** (setup done)
       - `phase2-scaffold` -> **jump to STATE 11** (design done)
       - `phase2-wire` -> **jump to STATE 14** (scaffold done)
       - `awaiting-verify` -> **TERMINAL**. Bootstrap complete. Run `/verify` to validate and create PR.
     - Tell user: "Resuming bootstrap from [checkpoint]. Archetype: [archetype]."
  2. If no frontmatter (old format): fall back to current behavior — skip States 1-7, jump to STATE 8.
- If `package.json` exists AND `src/app/` contains page or route entry points:
  VERIFY: `find src/app -name 'page.tsx' -o -name 'route.ts' 2>/dev/null | head -1`
  If output is non-empty: stop and tell the user: "This project has already been bootstrapped. Use `/change ...` to make changes, or run `make clean` to start over."
- If `package.json` exists but the `src/` directory does NOT contain application files: warn the user: "A previous bootstrap may have partially completed. I'll continue from the beginning — packages may be reinstalled." Note: the branch name `feat/bootstrap` may already exist from the previous attempt. If so, this run will use `feat/bootstrap-2` — you can delete the old branch later with `git branch -d feat/bootstrap`. Then proceed.

**POSTCONDITIONS:**
- Decision made: fresh start, resume at specific state, or stop (already bootstrapped)
- If resuming: archetype, stack, and checkpoint restored from frontmatter

**VERIFY:**
```bash
# For fresh start: no current-plan.md or no src/*.ts files
# For resume: checkpoint value extracted and matched to a valid state
echo "Precondition check complete"
```

**STATE TRACKING:** After postconditions pass, mark this state complete:
```bash
bash .claude/scripts/advance-state.sh bootstrap 4
```

**NEXT:** STATE 5 (fresh) | STATE 9/10/11/14 (resume) | TERMINAL (awaiting-verify). Read the appropriate state file:
- Fresh start: [state-5-present-plan.md](state-5-present-plan.md)
- Resume phase2-setup: [state-9-setup-phase.md](state-9-setup-phase.md)
- Resume phase2-design: [state-10-design-phase.md](state-10-design-phase.md)
- Resume phase2-scaffold: [state-11-parallel-scaffold.md](state-11-parallel-scaffold.md)
- Resume phase2-wire: [state-14-wire-phase.md](state-14-wire-phase.md)
- Resume awaiting-verify: TERMINAL -- run `/verify` next
