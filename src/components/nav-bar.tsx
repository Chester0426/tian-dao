"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/assay", label: "Assay" },
  { href: "/lab", label: "Lab" },
  { href: "/compare", label: "Compare" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }: { data: { session: { user: User } | null } }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isLanding = pathname === "/" || pathname.startsWith("/v/");

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2 font-display text-xl tracking-tight transition-colors hover:text-gold"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gold/10 text-gold transition-all group-hover:bg-gold/20 group-hover:shadow-[0_0_12px_var(--glow-gold)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M6 3h12l3 6-9 12L3 9z" />
              <path d="M3 9h18" />
              <path d="M12 21V9" />
            </svg>
          </span>
          Assayer
        </Link>

        {/* Desktop nav links */}
        {!isLanding && (
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* Auth section */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-20 animate-skeleton rounded-md bg-muted" />
          ) : user ? (
            <>
              <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground md:block">
                {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-border/50 text-sm hover:border-gold/30 hover:text-gold"
              >
                Log out
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="border-border/50 text-sm hover:border-gold/30 hover:text-gold"
              >
                Log in
              </Button>
            </Link>
          )}

          {/* Mobile hamburger */}
          {!isLanding && (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                {mobileOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && !isLanding && (
        <div className="border-t border-border/30 bg-background/95 backdrop-blur-lg md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-6 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
