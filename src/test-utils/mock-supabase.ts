import { vi } from "vitest";

type QueryResult = { data: unknown; count?: number | null; error: unknown };

/**
 * Creates a mock Supabase client for testing API routes.
 *
 * Usage:
 *   const { mockSupabase, setResult } = createMockSupabase();
 *   vi.mock("@/lib/supabase-server", () => ({
 *     createServerSupabaseClient: vi.fn().mockResolvedValue(mockSupabase),
 *   }));
 *
 *   setResult("experiments", { data: [...], error: null });
 */
export function createMockSupabase(userId = "user-1", email = "test@example.com") {
  const tableResults = new Map<string, QueryResult>();
  const callLog: { table: string; method: string }[] = [];

  function setResult(table: string, result: QueryResult) {
    tableResults.set(table, result);
  }

  function getCallLog() {
    return callLog;
  }

  function wasTableCalled(table: string): boolean {
    return callLog.some((c) => c.table === table);
  }

  function wasMethodCalled(table: string, method: string): boolean {
    return callLog.some((c) => c.table === table && c.method === method);
  }

  function clearLog() {
    callLog.length = 0;
  }

  function buildChain(table: string): unknown {
    const result = () => tableResults.get(table) ?? { data: null, error: null };

    const chain: Record<string, unknown> = {};
    const methods = [
      "select",
      "insert",
      "update",
      "delete",
      "upsert",
      "eq",
      "neq",
      "is",
      "not",
      "order",
      "range",
      "limit",
      "single",
      "maybeSingle",
    ];

    for (const method of methods) {
      if (method === "single" || method === "maybeSingle") {
        chain[method] = vi.fn(() => {
          callLog.push({ table, method });
          return Promise.resolve(result());
        });
      } else {
        chain[method] = vi.fn((..._args: unknown[]) => {
          callLog.push({ table, method });
          return chain;
        });
      }
    }

    // Make the chain itself thenable (for queries without .single())
    // When you do `await supabase.from("x").select("...").eq("a", "b")`
    // it resolves the chain as a Promise
    Object.defineProperty(chain, "then", {
      value: (resolve: (val: unknown) => void) => {
        resolve(result());
      },
      configurable: true,
      enumerable: false,
    });

    return chain;
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      callLog.push({ table, method: "from" });
      return buildChain(table);
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: userId
              ? {
                  id: userId,
                  email,
                  aud: "authenticated",
                  app_metadata: {},
                  user_metadata: {},
                  created_at: "",
                }
              : null,
          },
          error: null,
        })
      ),
    },
  };

  return {
    mockSupabase,
    setResult,
    getCallLog,
    wasTableCalled,
    wasMethodCalled,
    clearLog,
  };
}
