export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { EnlightenmentClient } from "./enlightenment-client";

export default async function EnlightenmentPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  const [profileRes, techniquesRes, inventoryRes] = await Promise.all([
    supabase.from("profiles").select("enlightenment_xp, enlightenment_level").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("player_techniques").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
  ]);

  return (
    <EnlightenmentClient
      enlightenmentXp={(profileRes.data?.enlightenment_xp as number) ?? 0}
      enlightenmentLevel={(profileRes.data?.enlightenment_level as number) ?? 1}
      learnedTechniques={(techniquesRes.data as { technique_slug: string; mastery_level: number; mastery_xp: number }[] | null) ?? []}
      inventory={(inventoryRes.data as { item_type: string; quantity: number }[] | null) ?? []}
    />
  );
}
