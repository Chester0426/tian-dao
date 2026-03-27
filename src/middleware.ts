import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/reset-password",
  "/api/health",
  "/v/cultivation",
  "/v/earn",
];

// Paths that require auth but NOT a slot selection
const noSlotPaths = [
  "/characters",
  "/api/game/init-profile",
  "/api/game/select-slot",
  "/api/game/delete-character",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and static files
  if (
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Demo mode bypass — skip auth for local dev / visual review
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true") {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check slot selection — redirect to /characters if no slot cookie set
  // Skip for paths that don't need a slot (character selection, slot APIs)
  if (!noSlotPaths.some((p) => pathname.startsWith(p))) {
    const slot = request.cookies.get("x-slot")?.value;
    if (!slot) {
      return NextResponse.redirect(new URL("/characters", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
