export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShopClient } from "./shop-client";

export default async function ShopPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    return <ShopClient spiritStones={0} currentSlots={20} />;
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  const [profileRes] = await Promise.all([
    supabase.from("profiles").select("inventory_slots").eq("user_id", user.id).eq("slot", slot).single(),
  ]);

  const currentSlots = (profileRes.data as { inventory_slots: number } | null)?.inventory_slots ?? 20;
  // 天道碎片 (GDAO) — not yet available, always 0
  const gdaoBalance = 0;

  return <ShopClient spiritStones={gdaoBalance} currentSlots={currentSlots} />;
}
