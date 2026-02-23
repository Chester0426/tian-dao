import { createClient } from "@supabase/supabase-js";
import { readFileSync, unlinkSync } from "fs";
import path from "path";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const AUTH_FILE = path.join(__dirname, ".auth.json");

export default async function globalTeardown() {
  try {
    const { userId } = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await supabase.auth.admin.deleteUser(userId);
    unlinkSync(AUTH_FILE);
  } catch {
    // Swallow errors — cleanup is best-effort
  }
}
