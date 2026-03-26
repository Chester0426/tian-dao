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
