// POST /api/game/rename — set or change character name
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Blocked words (Chinese + English profanity, slurs, offensive terms)
const BLOCKED_PATTERNS = [
  // Chinese
  /[操肏草幹]你[媽妈嗎]/, /[傻煞]逼/, /[贱賤]人/, /你[妈媽]/, /[鷄雞]巴/, /狗日/,
  /[死殺]全家/, /廢物/, /[婊嫖]子/, /[他她]媽的/, /滾蛋/, /白癡/, /智障/,
  /去死/, /垃圾/, /廢柴/, /王八蛋/, /混蛋/,
  // Japanese
  /バカ/, /死ね/, /クソ/, /アホ/,
  // English
  /\bfuck/i, /\bshit/i, /\bass\b/i, /\bbitch/i, /\bdick/i, /\bcunt/i,
  /\bnigge/i, /\bfag/i, /\bretard/i, /\bwhore/i, /\bslut/i,
  /\bkill\s*(your)?self/i, /\bdie\b/i,
  // Admin impersonation
  /admin/i, /gm\b/i, /moderator/i, /天道官方/, /客服/,
];

const schema = z.object({
  name: z.string().min(1).max(12),
});

export async function POST(request: NextRequest) {
  const { verifyProfile } = await import("@/lib/verify-profile");
  const vResult = await verifyProfile(request);
  if ("error" in vResult) return vResult.error;
  const { user, slot, supabase } = vResult;

  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "名稱需要 1-12 個字元" }, { status: 400 });
  }

  const name = body.name.trim();

  // Validate characters: Chinese, Japanese, English, numbers, underscore, space
  if (!/^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ffa-zA-Z0-9_ ]+$/.test(name)) {
    return NextResponse.json({ error: "名稱只支援中文、日文、英文、數字" }, { status: 400 });
  }

  // Check blocked words
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(name)) {
      return NextResponse.json({ error: "名稱包含不允許的字詞" }, { status: 400 });
    }
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("character_name", name)
    .neq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "此名稱已被使用" }, { status: 409 });
  }

  await supabase
    .from("profiles")
    .update({ character_name: name })
    .eq("user_id", user.id).eq("slot", slot);

  return NextResponse.json({ ok: true, name });
}
