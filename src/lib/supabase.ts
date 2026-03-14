import { createBrowserClient } from "@supabase/ssr";

function createDemoClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainable = (terminal: unknown): any =>
    new Proxy(() => terminal, {
      get: (_, prop) => (prop === "then" ? undefined : chainable(terminal)),
      apply: () => chainable(terminal),
    });
  const query = () => chainable({ data: [], error: null });
  return {
    from: () => ({
      select: query,
      insert: query,
      update: query,
      delete: query,
      upsert: query,
    }),
    auth: new Proxy(
      {
        getUser: () =>
          Promise.resolve({
            data: {
              user: {
                id: "demo-user-id",
                email: "demo@example.com",
                app_metadata: {},
                user_metadata: {},
                aud: "authenticated",
                created_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        getSession: () =>
          Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
      {
        get: (target, prop) =>
          prop in target
            ? target[prop as keyof typeof target]
            : () => Promise.resolve({ data: {}, error: null }),
      }
    ),
    rpc: () => chainable({ data: null, error: null }),
  } as unknown as ReturnType<typeof createBrowserClient>;
}

export function createClient() {
  if (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return createDemoClient();
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"
  );
}
