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

  const [profileRes, spiritRes] = await Promise.all([
    supabase.from("profiles").select("inventory_slots").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("inventory_items").select("quantity").eq("user_id", user.id).eq("slot", slot).eq("item_type", "spirit_stone_fragment").single(),
  ]);

  const currentSlots = (profileRes.data as { inventory_slots: number } | null)?.inventory_slots ?? 20;
  const spiritStones = (spiritRes.data as { quantity: number } | null)?.quantity ?? 0;

  return <ShopClient spiritStones={spiritStones} currentSlots={currentSlots} />;
}
