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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  }

  return (
    <div className="ink-noise relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 md:px-12">
      <div className="pointer-events-none absolute inset-0 mist-gradient" />

      {/* Decorative ink wash clouds */}
      <div
        className="pointer-events-none absolute left-[-10%] top-[15%] h-[400px] w-[500px] rounded-full opacity-[0.04]"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--jade) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[5%] right-[-5%] h-[350px] w-[450px] rounded-full opacity-[0.05]"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--cinnabar) 0%, transparent 70%)",
        }}
      />

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
        {/* Header with decorative seal */}
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

          <h1
            className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition:
                "opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s",
            }}
          >
            重設密碼
          </h1>
          <p
            className="mt-2 text-sm text-muted-foreground"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition:
                "opacity 0.5s ease-out 0.3s, transform 0.5s ease-out 0.3s",
            }}
          >
            Set a new password for your cultivation journey
          </p>
        </div>

        {/* Reset Card */}
        <Card
          className="scroll-surface border-border/50 backdrop-blur-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition:
              "opacity 0.5s ease-out 0.35s, transform 0.5s ease-out 0.35s",
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg">New Password</CardTitle>
            <CardDescription>
              Choose a strong password to protect your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleReset} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reset-password">Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || success}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={8}
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="reset-confirm">Confirm Password</Label>
                <Input
                  id="reset-confirm"
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || success}
                  autoComplete="new-password"
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              {error && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  className="rounded-lg border border-jade/30 bg-jade-dim px-3 py-2 text-sm text-jade"
                  role="status"
                >
                  Password updated successfully. Returning to your journey...
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading || success}
                className="h-11 text-base font-medium transition-all duration-200 hover:seal-glow hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Updating...
                  </span>
                ) : success ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Password Set
                  </span>
                ) : (
                  "Set New Password"
                )}
              </Button>
            </form>

            <Separator className="my-5 opacity-50" />

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-cinnabar underline-offset-4 transition-colors duration-150 hover:text-cinnabar/80 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Bottom decorative text */}
        <p
          className="mt-6 text-center font-heading text-xs text-ink-3 opacity-60"
          style={{
            opacity: mounted ? 0.6 : 0,
            transition: "opacity 0.5s ease-out 0.5s",
          }}
        >
          守護修仙之旅
        </p>
      </div>
    </div>
  );
}
