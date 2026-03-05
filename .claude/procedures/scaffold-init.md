# Scaffold: Project Initialization

This procedure is executed by a team teammate spawned by `/bootstrap`.
As an independent Claude Code session, you have full access to project
files, plugins (frontend-design, typescript-lsp), and tools.

## Scope

Execute Step 1 (project initialization) only. Library files, pages,
external dependencies, landing page, and wiring are handled by separate
teammates.

## Prerequisites
- Branch already created (by bootstrap Step 0)
- Plan approved and saved to `.claude/current-plan.md`
- Read all context files listed in your task assignment before starting

## Steps

### Step 1: Project initialization
- Create `package.json` with `name` from idea.yaml and project setup from the framework stack file (.nvmrc, scripts, engines, tsconfig, config)
- Install packages from all stack files whose categories are present in idea.yaml `stack`
- Install dev dependencies from the framework and UI stack files
- Check if `typescript-language-server` is available globally (`which typescript-language-server`). If not found, tell the user: "The `typescript-lsp` plugin is enabled for this template but requires a global binary. Install it with: `npm install -g typescript-language-server typescript`. This gives Claude real-time type checking during code generation — errors are caught immediately instead of at build time." Then **stop and wait** for the user to confirm they've installed it (or to say "skip"). If the user confirms installation, re-check with `which typescript-language-server` to verify. If the user says "skip", proceed without it.
- Run the UI setup commands from the UI stack file
- After UI setup, verify the UI stack file's post-setup checks pass (PostCSS config, globals.css, scripts intact). If any post-setup check fails: stop and tell the user which check failed and how to fix it (e.g., "PostCSS config was overwritten by shadcn init — restore it from the framework stack file template"). Do not proceed until all post-setup checks pass.
- After post-setup checks pass, make design decisions:
  1. Derive the three design constraints per `.claude/patterns/design.md` (color direction, design philosophy, optimization target) from idea.yaml's product domain.
  2. **Invoke the `frontend-design` skill** (via the Skill tool) with the constraints and idea.yaml content. The skill has full authority over visual direction within the derived constraints.
  3. If the skill is not available (not listed in available skills): stop and tell the user:
     > The `frontend-design` plugin is enabled in `.claude/settings.json` but did not load in this session. Restart Claude Code to reload plugins. If the issue persists, verify `"frontend-design@claude-plugins-official": true` is set in `.claude/settings.json`.
     Then **stop and wait** for the user to confirm it's fixed (or to say "skip"). If the user says "skip", proceed using your own judgment — match the product's personality, not framework defaults.
  4. Record choices in globals.css custom properties and tailwind config per the theme contract in design.md. Font setup applies when layout.tsx is created by the pages teammate.
- If any install command fails: stop, show the error, and ask the user to fix the environment issue. After fixing, tell Claude: "Continue the bootstrap on this branch from the install step." Claude will re-run the failed install and any subsequent install commands, then continue. Do NOT re-run `/bootstrap` (that would create a duplicate branch). If you close this conversation: either (1) commit partial files on this branch (`git add -A && git commit -m "WIP: partial install"`), then tell Claude "Continue the bootstrap on this branch from the install step"; or (2) switch to main (`git checkout main`), run `make clean`, and start `/bootstrap` fresh.

## Completion Report

When done, report:
1. Packages installed (list)
2. UI setup result (pass/fail, any post-setup fixes)
3. Design decisions: color direction, design philosophy, optimization target
4. Theme tokens written (globals.css custom properties, tailwind config)
5. Issues encountered (if any)
