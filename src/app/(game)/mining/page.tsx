export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MINE_DISPLAY: Record<string, { description: string; icon: string }> = {
  depleted_vein: {
    description: "最基礎的礦脈，蘊含微量靈氣。初入修途者的起點。",
    icon: "⛏",
  },
};

export default async function MiningListPage() {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";

  if (isDemo) {
    return (
      <MineList mines={[{
        id: "demo", name: "枯竭礦脈", slug: "depleted_vein",
        required_level: 1, rock_base_hp: 1, respawn_seconds: 5,
        xp_mining: 5, xp_mastery: 3, xp_body: 5,
      }]} playerLevel={1} />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const slot = parseInt(cookieStore.get("x-slot")?.value ?? "1", 10);

  const [minesRes, skillRes] = await Promise.all([
    supabase.from("mines").select("id, name, slug, required_level, rock_base_hp, respawn_seconds, xp_mining, xp_mastery, xp_body").order("required_level", { ascending: true }),
    supabase.from("mining_skills").select("level").eq("user_id", user.id).eq("slot", slot).single(),
  ]);

  const mines = minesRes.data ?? [];
  const playerLevel = (skillRes.data as { level: number } | null)?.level ?? 1;

  return <MineList mines={mines} playerLevel={playerLevel} />;
}

interface MineInfo {
  id: string;
  name: string;
  slug: string;
  required_level: number;
  rock_base_hp: number;
  respawn_seconds: number;
  xp_mining: number;
  xp_mastery: number;
  xp_body: number;
}

function MineList({ mines, playerLevel }: { mines: MineInfo[]; playerLevel: number }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            礦場
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            選擇礦場開始采掘
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mines.map((mine) => {
            const display = MINE_DISPLAY[mine.slug];
            const isLocked = playerLevel < mine.required_level;

            return (
              <Link
                key={mine.id}
                href={isLocked ? "#" : `/mining/${mine.slug}`}
                className={isLocked ? "pointer-events-none" : ""}
              >
                <Card className={`scroll-surface transition-all duration-300 h-full ${
                  isLocked
                    ? "opacity-50 border-dashed"
                    : "hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                }`}>
                  <CardContent className="flex flex-col gap-3 py-6">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{display?.icon ?? "⛏"}</span>
                      {isLocked ? (
                        <Badge variant="outline" className="text-muted-foreground border-border/40">
                          需要 Lv.{mine.required_level}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-jade/30 text-jade">
                          Lv.{mine.required_level}+
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h2 className="font-heading text-lg font-bold">{mine.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {display?.description ?? "未知礦脈"}
                      </p>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary" className="gap-1 bg-jade-dim text-jade">
                        采掘 {mine.xp_mining}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 bg-cinnabar-dim text-cinnabar">
                        精通 {mine.xp_mastery}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 bg-spirit-gold-dim text-spirit-gold">
                        練體 {mine.xp_body}
                      </Badge>
                    </div>

                    {isLocked && (
                      <p className="text-xs text-muted-foreground/60">
                        提升采掘等級至 Lv.{mine.required_level} 解鎖
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
