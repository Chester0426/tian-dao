import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client using the service role key.
 * This bypasses RLS and should ONLY be used for server-to-server operations
 * (webhooks, cron jobs) where there is no user session.
 *
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin operations"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
