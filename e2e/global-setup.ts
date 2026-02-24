import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const AUTH_FILE = path.join(__dirname, ".auth.json");

export default async function globalSetup() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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
