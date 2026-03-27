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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch {
      setErrorMessage("Google 登入失敗，請重新嘗試。");
      setLoading(false);
    }
  };

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
      {/* Layered atmospheric background */}
      <div className="pointer-events-none absolute inset-0 mist-gradient" />

      {/* Floating ink particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-[15%] top-[20%] h-1 w-1 rounded-full bg-cinnabar/20"
          style={{
            animation: "float-particle 6s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute right-[20%] top-[35%] h-1.5 w-1.5 rounded-full bg-jade/15"
          style={{
            animation: "float-particle 8s ease-in-out infinite alternate-reverse",
            animationDelay: "-2s",
          }}
        />
        <div
          className="absolute left-[25%] bottom-[25%] h-0.5 w-0.5 rounded-full bg-spirit-gold/20"
          style={{
            animation: "float-particle 7s ease-in-out infinite alternate",
            animationDelay: "-4s",
          }}
        />
        <div
          className="absolute right-[12%] bottom-[40%] h-1 w-1 rounded-full bg-cinnabar/15"
          style={{
            animation: "float-particle 9s ease-in-out infinite alternate-reverse",
            animationDelay: "-1s",
          }}
        />
        <div
          className="absolute left-[40%] top-[12%] h-0.5 w-0.5 rounded-full bg-jade/10"
          style={{
            animation: "float-particle 5s ease-in-out infinite alternate",
            animationDelay: "-3s",
          }}
        />
      </div>

      {/* Decorative vertical brush stroke accent */}
      <div
        className="pointer-events-none absolute left-[8%] top-[10%] hidden h-[45%] w-px md:block"
        style={{
          background: "linear-gradient(180deg, transparent, var(--cinnabar-dim), var(--jade-dim), transparent)",
          opacity: mounted ? 0.5 : 0,
          transition: "opacity 1.2s ease-out 0.4s",
        }}
      />
      <div
        className="pointer-events-none absolute right-[8%] bottom-[10%] hidden h-[35%] w-px md:block"
        style={{
          background: "linear-gradient(0deg, transparent, var(--ink-4), transparent)",
          opacity: mounted ? 0.3 : 0,
          transition: "opacity 1.2s ease-out 0.6s",
        }}
      />

      <div
        className="relative z-10 w-full max-w-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          filter: mounted ? "blur(0)" : "blur(6px)",
          transition:
            "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), filter 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="mb-10 text-center">
          {/* Enlarged seal icon with animated qi-pulse border */}
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-xl border border-cinnabar/30 bg-cinnabar-dim"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted
                ? "scale(1) rotate(0deg)"
                : "scale(1.4) rotate(-8deg)",
              transition:
                "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
              boxShadow: mounted
                ? "0 0 24px var(--cinnabar-dim), 0 0 48px oklch(0.62 0.20 25 / 6%), inset 0 1px 0 oklch(1 0 0 / 5%)"
                : "none",
            }}
          >
            <span className="font-heading text-3xl font-bold text-cinnabar text-glow-cinnabar">
              仙
            </span>
          </div>

          <h1
            className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.5s ease-out 0.25s, transform 0.5s ease-out 0.25s",
            }}
          >
            歡迎回來
          </h1>
          <p
            className="mt-3 text-sm text-muted-foreground"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.5s ease-out 0.35s, transform 0.5s ease-out 0.35s",
            }}
          >
            登入繼續你的修仙之旅
          </p>

          {/* Decorative horizontal brush stroke under header */}
          <div
            className="mx-auto mt-5 h-px w-16"
            style={{
              background: "linear-gradient(90deg, transparent, var(--cinnabar), transparent)",
              opacity: mounted ? 0.4 : 0,
              transform: mounted ? "scaleX(1)" : "scaleX(0)",
              transition: "opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s",
            }}
          />
        </div>

        <Card
          className="scroll-surface border-border/50 backdrop-blur-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s",
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg">登入</CardTitle>
            <CardDescription>使用 Email 登入你的帳號</CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mb-4 h-12 w-full gap-3 text-base font-medium transition-all duration-200 hover:bg-muted/50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
              </svg>
              使用 Google 登入
            </Button>

            <div className="relative mb-4">
              <Separator className="opacity-40" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                或
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div
                className="flex flex-col gap-2"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateX(0)" : "translateX(-8px)",
                  transition: "opacity 0.4s ease-out 0.45s, transform 0.4s ease-out 0.45s",
                }}
              >
                <Label htmlFor="login-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                  className="h-11 text-[16px] transition-all duration-200 focus-visible:shadow-[0_0_16px_var(--cinnabar-dim)] focus-visible:border-cinnabar/40"
                />
              </div>

              <div
                className="flex flex-col gap-2"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateX(0)" : "translateX(-8px)",
                  transition: "opacity 0.4s ease-out 0.55s, transform 0.4s ease-out 0.55s",
                }}
              >
                <Label htmlFor="login-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  密碼
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="輸入密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-11 text-[16px] transition-all duration-200 focus-visible:shadow-[0_0_16px_var(--cinnabar-dim)] focus-visible:border-cinnabar/40"
                />
              </div>

              {errorMessage && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-1 h-12 text-base font-medium transition-all duration-200 hover:seal-glow hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 0.4s ease-out 0.65s, transform 0.4s ease-out 0.65s, box-shadow 0.2s, scale 0.15s",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                    登入中...
                  </span>
                ) : (
                  "進入修仙界"
                )}
              </Button>
            </form>

            <Separator className="my-6 opacity-40" />

            <p className="text-center text-sm text-muted-foreground">
              還沒有帳號？{" "}
              <Link
                href="/signup"
                className="font-medium text-cinnabar underline-offset-4 transition-all duration-200 hover:text-cinnabar/80 hover:underline hover:underline-offset-[6px]"
              >
                註冊帳號
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Bottom decorative element */}
        <p
          className="mt-6 text-center font-heading text-xs tracking-[0.3em] text-muted-foreground/40"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease-out 0.8s",
          }}
        >
          修 仙 之 路
        </p>
      </div>
    </div>
  );
}
