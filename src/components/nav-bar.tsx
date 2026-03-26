"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then((res: { data: { session: { user: User } | null }; error: unknown }) => {
      setUser(res.data?.session?.user ?? null);
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

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <Link href="/" className="font-heading text-xl font-bold text-cinnabar">
        仙途放置
      </Link>
      <div className="flex items-center gap-2">
        {loading ? (
          <Button variant="outline" disabled className="min-w-[70px]">
            &nbsp;
          </Button>
        ) : user ? (
          <>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Dashboard
            </Link>
            <Link
              href="/mining"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Mining
            </Link>
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </span>
            <Button variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
