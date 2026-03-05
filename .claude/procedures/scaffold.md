# Scaffold Procedure

This procedure is executed by a team teammate spawned by `/bootstrap`
after the plan is approved. As an independent Claude Code session, you
have full access to project files, plugins (frontend-design, typescript-lsp),
and tools.

## Scope
Execute Steps 1 through 4c. Do NOT create API routes (Step 5), database
schema (Step 6), tests (Step 7b), or open a PR (Step 9). Those are handled
by the wire teammate.

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
- After UI setup, verify the UI stack file's post-setup checks pass (PostCSS config, globals.css, scripts intact). If any post-setup check fails: stop and tell the user which check failed and how to fix it (e.g., "PostCSS config was overwritten by shadcn init — restore it from the framework stack file template"). Do not proceed to Step 2 until all post-setup checks pass.
- After post-setup checks pass, make design decisions:
  1. Derive the three design constraints per `.claude/patterns/design.md` (color direction, design philosophy, optimization target) from idea.yaml's product domain.
  2. **Invoke the `frontend-design` skill** (via the Skill tool) with the constraints and idea.yaml content. The skill has full authority over visual direction within the derived constraints.
  3. If the skill is not available (not listed in available skills): stop and tell the user:
     > The `frontend-design` plugin is enabled in `.claude/settings.json` but did not load in this session. Restart Claude Code to reload plugins. If the issue persists, verify `"frontend-design@claude-plugins-official": true` is set in `.claude/settings.json`.
     Then **stop and wait** for the user to confirm it's fixed (or to say "skip"). If the user says "skip", proceed using your own judgment — match the product's personality, not framework defaults.
  4. Record choices in globals.css custom properties and tailwind config per the theme contract in design.md. Font setup applies in Step 3 when layout.tsx is created.
- If any install command fails: stop, show the error, and ask the user to fix the environment issue. After fixing, tell Claude: "Continue the bootstrap on this branch from the install step." Claude will re-run the failed install and any subsequent install commands, then continue with Step 2. Do NOT re-run `/bootstrap` (that would create a duplicate branch). If you close this conversation: either (1) commit partial files on this branch (`git add -A && git commit -m "WIP: partial install"`), then tell Claude "Continue the bootstrap on this branch from the install step"; or (2) switch to main (`git checkout main`), run `make clean`, and start `/bootstrap` fresh.

### Steps 2-4b: Parallel scaffold agents

After Step 1 completes, spawn three agents simultaneously using parallel
Agent tool calls (same pattern as verify.md Parallel Review).

#### Agent A — Library files
Spawn Agent (general-purpose):
- Read `.claude/procedures/scaffold-libs.md` and execute
- Context: idea.yaml, EVENTS.yaml, `.claude/current-plan.md`, all stack files
- Rules: CLAUDE.md 3, 4, 6, 7

#### Agent B — App shell & pages
Spawn Agent (general-purpose):
- Read `.claude/procedures/scaffold-pages.md` and execute
- Context: idea.yaml, EVENTS.yaml, `.claude/current-plan.md`, archetype file,
  framework/UI stack files, `design.md`
- Rules: CLAUDE.md 3, 4, 6, 7, 9

#### Agent C — External dependencies
Spawn Agent (general-purpose):
- Read `.claude/procedures/scaffold-externals.md` and execute
- Context: idea.yaml, `.claude/current-plan.md`, `.claude/stacks/TEMPLATE.md`, existing stack files
- Rules: CLAUDE.md 3, 4, 6

Wait for all three agents to complete before continuing.

### Fake Door integration (if Agent C reported Fake Door features)

For each Fake Door feature reported by Agent C, generate a component in the page
folder where the feature would naturally appear (e.g., `src/app/dashboard/sms-fake-door.tsx`):
- Real, polished UI using shadcn components (Card + Button + Dialog), following `.claude/patterns/design.md`
- On button click: `track("activate", { action: "[feature-name]", fake_door: true })`
- Shows a Dialog: "[Feature Name] is coming soon — we're building this now."
- Import and render the Fake Door component in the parent page where the feature would naturally live
- The component should look like a real feature entry point — not a placeholder or disabled button

### Merged Checkpoint — verify combined output

- Re-read `.claude/current-plan.md` to confirm alignment
- Run `npm run build` to verify all library files, pages, and Fake Door
  components compile correctly
- If build fails: fix errors, re-run (2 attempt budget)
- If still fails after 2 attempts: defer to Step 8 (verify.md 3-attempt retry)

### Step 4c: Landing page generation (if surface ≠ none)

Resolve the surface type: if `stack.surface` is set in idea.yaml, use it.
Otherwise infer: `stack.hosting` present → `co-located`; absent → `detached`.
Read the surface stack file at `.claude/stacks/surface/<value>.md`.

- **surface: none**: skip this step entirely.

**All other cases**: Launch an Agent (subagent_type: general-purpose) with a
focused creative brief. The agent runs in a clean context — free from the
infrastructure setup that preceded this step.

Include in the agent prompt:

1. The full content of idea.yaml (product context)
2. The three derived constraints from design.md (color direction, design
   philosophy, optimization target — already decided in Step 1)
3. The quality bar from design.md: "Create a world-class, conversion-optimized
   landing page. The visual quality must match a $50K agency page — not
   adequate, exceptional."
4. Copy derivation rules from messaging.md Section A (headline = outcome for
   target_user, CTA = action verb + outcome)
5. Content inventory from messaging.md Section B (raw material, not structure)
6. Instruction: "If the `frontend-design` skill is available in your context,
   invoke it to make visual decisions within the derived constraints, then use
   its output for the page. If the skill is not available, the creative brief
   and constraints above provide sufficient direction — proceed with your own
   creative judgment."
7. Technical context per archetype (see below)

**web-app + co-located** (React component):
- Include: theme tokens (globals.css custom properties, tailwind config from
  Step 1), available shadcn/ui components, analytics function signatures from
  `src/lib/events.ts`, framework page conventions from framework stack file
- If no `variants`: agent writes `src/app/page.tsx` — a complete React landing
  page component. Must fire `visit_landing` on mount with EVENTS.yaml properties.
- If `variants`: agent writes `src/components/landing-content.tsx` — a shared
  `LandingContent` component that accepts variant props (headline, subheadline,
  cta, pain_points). Features section is shared across variants (from idea.yaml
  `features`). The structural routing files (variants.ts, root page, dynamic
  route) were already created in Step 4.

**service + co-located** (self-contained HTML):
- Include: surface stack file content (route path, analytics wiring, CSS approach)
- Agent writes the route handler file at [path from framework stack file]
  returning a complete self-contained HTML page

**cli + detached** (self-contained HTML):
- Include: surface stack file content (file path, CSS approach)
- Agent writes `site/index.html` as a complete self-contained HTML page

After the agent returns, verify the output:
- Wire analytics if `stack.analytics` is present and not already included by
  the agent (add inline snippet for service/cli per surface stack file's
  analytics section; for web-app, verify event imports and tracking calls)
- Run `npm run build` to verify the landing page compiles (web-app only)

## Completion Report

When all steps are complete, report:
1. Build Checkpoint result (pass/fail, attempt count)
2. External dependencies: [service] → [core/non-core] → [chosen option]
3. User decisions made during external evaluation
4. Template observations (if any)
5. Generated external stack files (paths)
6. Env vars added to .env.local (if any)
