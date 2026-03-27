export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { InventoryItem } from "@/lib/types";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    return <InventoryClient inventory={[]} totalSlots={20} daoPoints={0} />;
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  const [profileRes, inventoryRes] = await Promise.all([
    supabase.from("profiles").select("inventory_slots, dao_points").eq("user_id", user.id).eq("slot", slot).single(),
    supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("slot", slot),
  ]);

  const profileData = profileRes.data as { inventory_slots: number; dao_points: number } | null;
  const totalSlots = profileData?.inventory_slots ?? 20;
  const daoPoints = profileData?.dao_points ?? 0;
  const inventory = (inventoryRes.data as InventoryItem[]) ?? [];

  return <InventoryClient inventory={inventory} totalSlots={totalSlots} daoPoints={daoPoints} />;
}
