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
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Default RPC results — keyed by function name
  const rpcResults = new Map<string, QueryResult>();

  function setRpcResult(funcName: string, result: QueryResult) {
    rpcResults.set(funcName, result);
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      callLog.push({ table, method: "from" });
      return buildChain(table);
    }),
    rpc: vi.fn((funcName: string, _params?: Record<string, unknown>) => {
      callLog.push({ table: `rpc:${funcName}`, method: "rpc" });
      const result = rpcResults.get(funcName) ?? { data: { allowed: true }, error: null };
      return Promise.resolve(result);
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
    setRpcResult,
    getCallLog,
    wasTableCalled,
    wasMethodCalled,
    clearLog,
  };
}
