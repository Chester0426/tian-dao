import { createClient } from "@supabase/supabase-js";
import { readFileSync, unlinkSync } from "fs";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth.json");

export default async function globalTeardown() {
  try {
    const { userId } = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await supabase.auth.admin.deleteUser(userId);
    unlinkSync(AUTH_FILE);
  } catch {
    // Swallow errors — cleanup is best-effort
  }
}
