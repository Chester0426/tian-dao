// GET /api/game/leaderboard?type=realm|mining|body — top 10 players
import { NextRequest, NextResponse } from "next/server";

const REALM_ORDER: Record<string, number> = {
  "煉體": 1, "練氣": 2, "築基": 3, "金丹": 4, "元嬰": 5,
};

export async function GET(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, supabase } = vResult;

  const type = request.nextUrl.searchParams.get("type") ?? "realm";

  if (type === "mining") {
    const { data: skills } = await supabase
      .from("mining_skills")
      .select("user_id, level, xp")
      .order("level", { ascending: false })
      .limit(10);

    if (!skills) return NextResponse.json({ leaderboard: [] });

    // Get character names
    const userIds = skills.map((s: { user_id: string }) => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, character_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as { user_id: string; character_name: string | null }[]) {
      nameMap[p.user_id] = p.character_name ?? `user-${p.user_id.slice(0, 6)}`;
    }

    return NextResponse.json({
      leaderboard: (skills as { user_id: string; level: number; xp: number }[]).map((s, i) => ({
        rank: i + 1,
        name: nameMap[s.user_id] ?? `user-${s.user_id.slice(0, 6)}`,
        level: s.level,
        isMe: s.user_id === user.id,
      })),
    });
  }

  if (type === "body") {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, character_name, body_level")
      .order("body_level", { ascending: false })
      .limit(10);

    if (!profiles) return NextResponse.json({ leaderboard: [] });

    return NextResponse.json({
      leaderboard: (profiles as { user_id: string; character_name: string | null; body_level: number }[]).map((p, i) => ({
        rank: i + 1,
        name: p.character_name ?? `user-${p.user_id.slice(0, 6)}`,
        level: p.body_level,
        isMe: p.user_id === user.id,
      })),
    });
  }

  // Default: realm
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, character_name, realm, body_level, qi_level")
    .limit(100);

  if (!profiles) return NextResponse.json({ leaderboard: [] });

  type P = { user_id: string; character_name: string | null; realm: string; body_level: number; qi_level: number };
  const sorted = (profiles as P[]).sort((a: P, b: P) => {
    const realmA = REALM_ORDER[a.realm] ?? 0;
    const realmB = REALM_ORDER[b.realm] ?? 0;
    if (realmA !== realmB) return realmB - realmA;
    const levelA = a.realm === "練氣" ? a.qi_level : a.body_level;
    const levelB = b.realm === "練氣" ? b.qi_level : b.body_level;
    return levelB - levelA;
  }).slice(0, 10);

  return NextResponse.json({
    leaderboard: sorted.map((p: P, i: number) => ({
      rank: i + 1,
      name: p.character_name ?? `user-${p.user_id.slice(0, 6)}`,
      realm: p.realm,
      level: p.realm === "練氣" ? p.qi_level : p.body_level,
      isMe: p.user_id === user.id,
    })),
  });
}
