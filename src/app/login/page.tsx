"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("請輸入 Email 和密碼。");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrorMessage("發生意外錯誤，請重新嘗試。");
      setLoading(false);
    }
  };

  return (
    <div className="ink-noise relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 md:px-12">
      <div className="pointer-events-none absolute inset-0 mist-gradient" />

      <div
        className="relative z-10 w-full max-w-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          filter: mounted ? "blur(0)" : "blur(4px)",
          transition:
            "opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s ease-out",
        }}
      >
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-cinnabar/20 bg-cinnabar-dim"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted
                ? "scale(1) rotate(0deg)"
                : "scale(1.3) rotate(-5deg)",
              transition:
                "opacity 0.5s ease-out 0.15s, transform 0.5s ease-out 0.15s",
            }}
          >
            <span className="font-heading text-2xl font-bold text-cinnabar text-glow-cinnabar">
              仙
            </span>
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            歡迎回來
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            登入繼續你的修仙之旅
          </p>
        </div>

        <Card className="scroll-surface border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">登入</CardTitle>
            <CardDescription>使用 Email 登入你的帳號</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password">密碼</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="輸入密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              {errorMessage && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-11 text-base font-medium transition-all duration-200 hover:seal-glow hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? "登入中..." : "進入修仙界"}
              </Button>
            </form>

            <Separator className="my-5 opacity-50" />

            <p className="text-center text-sm text-muted-foreground">
              還沒有帳號？{" "}
              <Link
                href="/signup"
                className="font-medium text-cinnabar underline-offset-4 transition-colors duration-150 hover:text-cinnabar/80 hover:underline"
              >
                註冊帳號
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
