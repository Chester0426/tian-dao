---
description: "Command-line tool distributed via package registry, no server hosting"
required_stacks: [framework]
optional_stacks: [database, analytics, testing]
excluded_stacks: [hosting, ui, auth, payment, email]
required_idea_fields: [commands]
build_command: "npm run build"
funnel_template: custom
---

# CLI Archetype

Command-line tool invoked by users on their local machine. The primary unit of
work is the **command** (not the page or endpoint). Use this archetype when
`type: cli` is set in idea.yaml.

## Structure

Each idea.yaml `commands` entry maps to a command module:

```
src/commands/<command-name>.ts
```

There are no page folders, no landing page, no UI components, no API routes,
no `src/app/` directory, and no `src/components/` directory. The `hosting`,
`ui`, `auth`, `payment`, and `email` stack categories are excluded.

## Funnel

CLIs use `funnel_template: custom` — there is no standard web funnel.
The standard web events (`visit_landing`, `signup_start`, `signup_complete`)
do not apply. Instead, define experiment-specific events in EVENTS.yaml
`custom_events`.

Typical CLI events (suggestions, not requirements):

1. `command_run` — user executes a command
2. `activate` — user completes the core action for the first time
3. `retain_return` — user runs the CLI again after 24+ hours since last use

All CLI events use `trackServerEvent()` from the server analytics library.
Analytics must be opt-in — check for a consent flag or environment variable
before sending any telemetry.

## Testing

CLIs use unit tests and CLI integration tests (e.g., Vitest, Jest), not
browser-based E2E tests (Playwright). The test runner comes from the testing
stack file.

CLI integration tests spawn the compiled binary and assert on stdout/stderr
and exit codes.

## Distribution

CLIs are distributed via package registries, not server hosting:

- `npm publish` — primary distribution for Node.js CLIs
- GitHub Releases — binary artifacts for non-Node users
- Homebrew formula — optional, for macOS users

The `/deploy` skill does not apply to CLI tools. Use `npm publish` or
GitHub Releases directly.

## Health Check

CLIs use `<cli-name> --version` as a smoke test (not an HTTP endpoint).
A successful version output confirms the binary is installed and executable.

## Conventions

- Every command fires analytics events per EVENTS.yaml (server-side, opt-in)
- No landing page requirement — `validate-idea.py` skips landing checks
- No UI components — the `ui` stack category is excluded
- No server hosting — the `hosting` stack category is excluded
- `package.json` must have a `bin` field pointing to the compiled entry point
- The entry point (`src/index.ts`) sets up the CLI program and registers commands
