import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
      },
      {
        get: (target, prop) =>
          prop in target
            ? target[prop as keyof typeof target]
            : () => Promise.resolve({ data: {}, error: null }),
      }
    ),
    rpc: () => chainable({ data: null, error: null }),
  } as unknown as ReturnType<typeof createServerClient>;
}

export async function createServerSupabaseClient() {
  if (process.env.DEMO_MODE === "true") return createDemoClient();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// Service-role client for API routes that write to DB (bypasses RLS)
import { createClient } from "@supabase/supabase-js";

export function createServiceSupabaseClient() {
  if (process.env.DEMO_MODE === "true") return createDemoClient() as ReturnType<typeof createClient>;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key",
  );
}
