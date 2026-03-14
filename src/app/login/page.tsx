"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { trackSignupStart } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const authError = searchParams.get("error") === "auth";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    router.push("/assay");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      }
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setForgotSent(true);
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    trackSignupStart({ method: provider });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-gold"
            >
              <path d="M6 3h12l3 6-9 12L3 9z" />
              <path d="M3 9h18" />
              <path d="M12 21V9" />
            </svg>
          </div>
          <CardTitle className="font-display text-2xl tracking-tight">
            Welcome back
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Log in to continue your experiments
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {confirmed && (
            <div className="rounded-lg bg-verdict-scale/10 px-4 py-3 text-sm text-verdict-scale">
              Email confirmed! Please log in.
            </div>
          )}
          {authError && (
            <div className="rounded-lg bg-verdict-kill/10 px-4 py-3 text-sm text-verdict-kill">
              Authentication failed. Please try again.
            </div>
          )}

          {forgotMode ? (
            forgotSent ? (
              <div className="space-y-4 text-center">
                <div className="rounded-lg bg-verdict-scale/10 px-4 py-3 text-sm text-verdict-scale">
                  Check your email for a reset link.
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                  }}
                  className="text-muted-foreground"
                >
                  Back to login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-base"
                  />
                </div>
                {error && (
                  <p className="text-sm text-verdict-kill">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold text-accent-foreground hover:bg-gold-bright"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setError("");
                  }}
                  className="w-full text-muted-foreground"
                >
                  Back to login
                </Button>
              </form>
            )
          ) : (
            <>
              {/* OAuth buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  className="w-full border-border/50 hover:border-gold/30"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleOAuthLogin("github")}
                  className="w-full border-border/50 hover:border-gold/30"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-gold"
                      onClick={() => {
                        setForgotMode(true);
                        setError("");
                      }}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-base"
                  />
                </div>
                {error && (
                  <p className="text-sm text-verdict-kill">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold text-accent-foreground hover:bg-gold-bright"
                >
                  {loading ? "Logging in..." : "Log in"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/assay"
                  className="text-gold underline-offset-4 hover:underline"
                >
                  Start with an idea
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
