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

  const [profileRes, techniquesRes, inventoryRes, sessionRes] = await Promise.all([
    supabase.from("profiles").select("enlightenment_xp, enlightenment_level").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("player_techniques").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
    supabase.from("idle_sessions").select("type, payload, ended_at").eq("user_id", user.id).eq("slot", slot).is("ended_at", null).maybeSingle(),
  ]);

  let initialTarget: { kind: "book"; item_type: string } | { kind: "technique"; technique_slug: string } | null = null;
  if (sessionRes.data && sessionRes.data.type === "enlightenment" && sessionRes.data.payload) {
    const p = sessionRes.data.payload as { kind?: string; item_type?: string; technique_slug?: string };
    if (p.kind === "book" && p.item_type) initialTarget = { kind: "book", item_type: p.item_type };
    else if (p.kind === "technique" && p.technique_slug) initialTarget = { kind: "technique", technique_slug: p.technique_slug };
  }

  return (
    <EnlightenmentClient
      enlightenmentXp={(profileRes.data?.enlightenment_xp as number) ?? 0}
      enlightenmentLevel={(profileRes.data?.enlightenment_level as number) ?? 1}
      learnedTechniques={(techniquesRes.data as { technique_slug: string; mastery_level: number; mastery_xp: number }[] | null) ?? []}
      inventory={(inventoryRes.data as { item_type: string; quantity: number }[] | null) ?? []}
      initialTarget={initialTarget}
    />
  );
}
