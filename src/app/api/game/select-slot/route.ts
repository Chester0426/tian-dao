import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slot = Number(body.slot);

    if (!slot || slot < 1 || slot > 3) {
      return NextResponse.json({ error: "Invalid slot (must be 1-3)" }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set("x-slot", String(slot), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({ slot });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
