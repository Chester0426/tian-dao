// GET /api/game/leaderboard — top 10 players by realm progression
import { NextRequest, NextResponse } from "next/server";

const REALM_ORDER: Record<string, number> = {
  "煉體": 1,
  "練氣": 2,
  "築基": 3,
  "金丹": 4,
  "元嬰": 5,
};

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { supabase } = vResult;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("character_name, realm, body_level, qi_level, realm_level")
    .not("character_name", "is", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!profiles) return NextResponse.json({ leaderboard: [] });

  // Sort by realm order desc, then level desc
  type P = { character_name: string; realm: string; body_level: number; qi_level: number; realm_level: number };
  const sorted = (profiles as P[]).sort((a: P, b: P) => {
    const realmA = REALM_ORDER[a.realm] ?? 0;
    const realmB = REALM_ORDER[b.realm] ?? 0;
    if (realmA !== realmB) return realmB - realmA;
    // Same realm: compare level
    const levelA = a.realm === "練氣" ? a.qi_level : a.body_level;
    const levelB = b.realm === "練氣" ? b.qi_level : b.body_level;
    return levelB - levelA;
  }).slice(0, 10);

  return NextResponse.json({
    leaderboard: sorted.map((p: P, i: number) => ({
      rank: i + 1,
      name: p.character_name,
      realm: p.realm,
      level: p.realm === "練氣" ? p.qi_level : p.body_level,
    })),
  });
}
