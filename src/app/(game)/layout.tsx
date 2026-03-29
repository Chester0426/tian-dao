export const dynamic = "force-dynamic";

import { GameLayout } from "@/components/game-layout";
import { MiningProvider } from "@/components/mining-provider";
import { SingleTabGuard } from "@/components/single-tab-guard";
import { OfflineRewardsChecker } from "@/components/offline-rewards-checker";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export default async function GameGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  let miningStatus = { isMining: false, mineId: null as string | null };

  if (!isDemo) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const cookieStore = await cookies();
        const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

        const { data: session } = await supabase
          .from("idle_sessions")
          .select("mine_id")
          .eq("user_id", user.id)
          .eq("slot", slot)
          .eq("type", "mining")
          .single();

        if (session?.mine_id) {
          miningStatus = { isMining: true, mineId: session.mine_id };
        }
      }
    } catch {
      // ignore — default to not mining
    }
  }

  return (
    <SingleTabGuard>
      <MiningProvider initialStatus={miningStatus}>
        <OfflineRewardsChecker hasActiveSession={miningStatus.isMining} />
        <GameLayout>{children}</GameLayout>
      </MiningProvider>
    </SingleTabGuard>
  );
}
