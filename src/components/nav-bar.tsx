"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  Beaker,
  LayoutGrid,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/assay", label: "Assay", icon: Beaker },
  { href: "/lab", label: "Lab", icon: LayoutGrid },
  { href: "/compare", label: "Compare", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: User } | null } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isLanding = pathname === "/" || pathname.startsWith("/v/");

  return (
    <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <FlaskConical className="size-5 text-gold" />
          <span className="font-display text-lg tracking-tight">Assayer</span>
        </Link>

        {/* Desktop nav links */}
        {!isLanding && (
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Right side: auth */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="max-w-[180px] truncate text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5" />
                Log out
              </Button>
            </div>
          ) : (
            <div className="hidden gap-2 md:flex">
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Log in</Link>
              <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Sign up</Link>
            </div>
          )}

          {/* Mobile hamburger */}
          {!isLanding && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && !isLanding && (
        <div className="border-t border-border/50 bg-background px-4 pb-4 pt-2 md:hidden animate-fade-in">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
            <div className="my-2 h-px bg-border/50" />
            {user ? (
              <>
                <span className="truncate px-3 text-sm text-muted-foreground">
                  {user.email}
                </span>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </>
            ) : (
              <div className="flex gap-2 px-3">
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex-1")}>Log in</Link>
                <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}>Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
