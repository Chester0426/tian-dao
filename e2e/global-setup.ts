import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth.json");

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const email = `e2e-${Date.now()}@test.example`;
  const password = "test-password-e2e-123";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  writeFileSync(AUTH_FILE, JSON.stringify({ email, password, userId: data.user.id }));
}
