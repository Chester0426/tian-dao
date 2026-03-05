# Scaffold: Project Initialization

This procedure is executed by an Agent subagent spawned by `/bootstrap`.
As an independent Claude Code session, you have full access to project
files, tools (LSP if available), and file system.

## Scope

Execute Step 1 (project initialization) only. Library files, pages,
external dependencies, landing page, and wiring are handled by separate
subagents.

## Prerequisites
- Branch already created (by bootstrap Step 0)
- Plan approved and saved to `.claude/current-plan.md`
- Read all context files listed in your task assignment before starting

## Steps

### Step 1: Project initialization
- Create `package.json` with `name` from idea.yaml and project setup from the framework stack file (.nvmrc, scripts, engines, tsconfig, config)
- Install packages from all stack files whose categories are present in idea.yaml `stack`
- Install dev dependencies from the framework and UI stack files
- The lead has already checked `typescript-language-server` availability. The TSP status is provided in your prompt. If status is `"skipped"`, proceed without it. If status is `"available"`, LSP type-checking is active.
- Run the UI setup commands from the UI stack file
- After UI setup, verify the UI stack file's post-setup checks pass (PostCSS config, globals.css, scripts intact). If any post-setup check fails: stop and tell the user which check failed and how to fix it (e.g., "PostCSS config was overwritten by shadcn init — restore it from the framework stack file template"). Do not proceed until all post-setup checks pass.
- After post-setup checks pass, make design decisions:
  1. Derive the three design constraints per `.claude/patterns/design.md` (color direction, design philosophy, optimization target) from idea.yaml's product domain.
  2. **Read the frontend-design SKILL.md** at the path provided in your prompt.
     If path is `"unavailable"`: proceed using your own judgment — match the
     product's personality, not framework defaults.
     If path is a valid file path: read the file and follow its methodology
     for visual direction within the derived constraints.
  3. Record choices in globals.css custom properties and tailwind config per the theme contract in design.md. Font setup applies when layout.tsx is created by the pages subagent.
- If any install command fails: stop, show the error, and ask the user to fix the environment issue. After fixing, tell Claude: "Continue the bootstrap on this branch from the install step." Claude will re-run the failed install and any subsequent install commands, then continue. Do NOT re-run `/bootstrap` (that would create a duplicate branch). If you close this conversation: either (1) commit partial files on this branch (`git add -A && git commit -m "WIP: partial install"`), then tell Claude "Continue the bootstrap on this branch from the install step"; or (2) switch to main (`git checkout main`), run `make clean`, and start `/bootstrap` fresh.

## Completion Report

When done, report:
1. Packages installed (list)
2. UI setup result (pass/fail, any post-setup fixes)
3. Design decisions: color direction, design philosophy, optimization target
4. Theme tokens written (globals.css custom properties, tailwind config)
5. Issues encountered (if any)
