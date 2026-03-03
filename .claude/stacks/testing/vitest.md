---
assumes: []
packages:
  runtime: []
  dev: [vitest, "@vitest/coverage-v8"]
files:
  - vitest.config.ts
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

## Patterns
- **Colocate tests**: place `*.test.ts` files next to the code they test (e.g., `src/routes/health.test.ts`)
- **Use framework test client**: prefer `app.request()` (Hono) or equivalent over `supertest` when available
- **Test file naming**: `*.test.ts` — vitest config includes this pattern by default
- **No browser tests**: vitest handles unit and API tests only — use Playwright for E2E browser testing
- **Coverage threshold**: not enforced by default — add thresholds in vitest.config.ts if needed

## PR Instructions
- Run `npm test` locally to verify tests pass
- Run `npm run test:coverage` to check coverage
- No CI secrets or external services needed for vitest
