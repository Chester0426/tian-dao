---
assumes: []
packages:
  runtime: []
  dev: [vitest, "@vitest/coverage-v8"]
files:
  - vitest.config.ts
  - tests/smoke.test.ts       # conditional: service archetype bootstrap smoke tests
  - tests/commands.test.ts    # conditional: cli archetype bootstrap smoke tests
env:
  server: []
  client: []
ci_placeholders: {}
clean:
  files: []
  dirs: []
gitignore: []
---
# Testing: Vitest
> Used when idea.yaml has `stack.testing: vitest`
> Assumes: nothing (framework-agnostic — works with any Node.js project)

## Packages
```bash
npm install -D vitest @vitest/coverage-v8
```

## Files to Create

### `vitest.config.ts` — Vitest configuration
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```
- `globals: true` — enables `describe`, `it`, `expect` without imports
- `environment: "node"` — runs tests in Node.js (not jsdom)
- `@/` alias matches the project's TypeScript path alias
- Coverage excludes test files and declaration files

## Test Patterns

### Unit Test for Route Handlers
Place unit tests alongside source files or in a `tests/` directory:

```ts
// src/routes/health.test.ts
import { describe, it, expect } from "vitest";
import app from "../index";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
```

- Use the framework's test client (e.g., Hono's `app.request()`) for lightweight API testing without spinning up a server
- For frameworks without a built-in test client, use `supertest` (add to `packages.dev` if needed)

### Unit Test for Business Logic
```ts
// src/lib/convert.test.ts
import { describe, it, expect } from "vitest";
import { convert } from "./convert";

describe("convert", () => {
  it("converts USD to EUR", () => {
    const result = convert(100, "USD", "EUR", 0.85);
    expect(result).toBe(85);
  });

  it("throws on unknown currency", () => {
    expect(() => convert(100, "XXX", "EUR", 0.85)).toThrow();
  });
});
```

### API Integration Test
```ts
// tests/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../src/index";

describe("API integration", () => {
  it("converts currency via /api/convert", async () => {
    const res = await app.request("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "USD", to: "EUR", amount: 100 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("result");
  });
});
```

## package.json Scripts
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## CI Integration

Vitest runs in the existing `build` CI job after lint, or in a dedicated test job. Since vitest tests are fast (no browser, no Docker), they fit in the build job:

```yaml
  # Add after the Lint step in the build job:
  - name: Test
    run: |
      if [ -f package.json ] && node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)" 2>/dev/null; then
        npm test
      else
        echo "No test script found — skipping"
      fi
```

No additional CI env vars or services needed — vitest runs entirely in-process.

## Bootstrap Smoke Tests

Bootstrap generates minimal smoke tests to verify that routes/commands are registered and reachable. These are created by `/bootstrap` Step 7b — not by hand.

### Service Smoke Tests — `tests/smoke.test.ts`

Template for `type: service` projects. One test per idea.yaml endpoint plus a health check:

```ts
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("smoke tests", () => {
  it("GET /api/health returns 200", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });

  // One test per idea.yaml endpoint:
  // GET endpoints:
  it("GET /api/<endpoint> does not 500", async () => {
    const res = await app.request("/api/<endpoint>");
    expect(res.status).not.toBe(500);
  });

  // POST endpoints — empty body (verifies route is registered, not input validation):
  it("POST /api/<endpoint> does not 500", async () => {
    const res = await app.request("/api/<endpoint>", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).not.toBe(500);
  });
});
```

- Imports `app` from `../src/index` — the framework's exported app instance
- Health check asserts status 200 (the `/api/health` endpoint always exists)
- Per-endpoint tests assert `not.toBe(500)` — smoke tests verify route registration, not business logic
- POST endpoints send an empty JSON body — a 400 (validation error) is acceptable, a 500 is not
- **Fallback for frameworks without `app.request()`** (e.g., Virtuals ACP): test handler functions directly by importing from `src/handlers/<name>` and calling with mock input. The test verifies the handler exists and returns without throwing.

### CLI Smoke Tests — `tests/commands.test.ts`

Template for `type: cli` projects. Tests `--version`, `--help`, and each idea.yaml command:

```ts
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node dist/index.js ${args}`, {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout ?? "",
      exitCode: error.status ?? 1,
    };
  }
}

describe("CLI smoke tests", () => {
  it("--version exits 0 and prints semver", () => {
    const { stdout, exitCode } = runCli("--version");
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it("--help exits 0 and prints usage", () => {
    const { stdout, exitCode } = runCli("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  // One test per idea.yaml command:
  it("<command> --help exits 0", () => {
    const { stdout, exitCode } = runCli("<command> --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("<command>");
  });
});
```

- Helper `runCli(args)` runs `node dist/index.js ${args}` via `execSync`, returns `{ stdout, exitCode }`
- `--version` test asserts exit code 0 and a semver-like pattern in output
- `--help` test asserts exit code 0 and "Usage:" in output (Commander.js default)
- Per-command tests run `<command> --help` and assert exit code 0 + command name in output
- **Requires `npm run build` first** — tests run against compiled output in `dist/`. CI runs build before test.

## Patterns
- **Colocate tests**: place `*.test.ts` files next to the code they test (e.g., `src/routes/health.test.ts`)
- **Use framework test client**: prefer `app.request()` (Hono) or equivalent over `supertest` when available
- **Test file naming**: `*.test.ts` — vitest config includes this pattern by default
- **No browser tests**: vitest handles unit and API tests only — use Playwright for E2E browser testing
- **Bootstrap smoke tests**: service archetypes test endpoints via `app.request()`, CLI archetypes test commands via `--help`. Both use vitest — no browser needed.
- **Coverage threshold**: not enforced by default — add thresholds in vitest.config.ts if needed

## PR Instructions
- Run `npm test` locally to verify tests pass
- Run `npm run test:coverage` to check coverage
- No CI secrets or external services needed for vitest
