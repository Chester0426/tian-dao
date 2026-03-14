"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { trackSignupStart } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

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
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
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
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12 bg-crucible">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center animate-fade-in-up stagger-1">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/10">
            <FlaskConical className="size-7 text-accent" />
          </div>
          <h1 className="font-display text-3xl">
            {forgotMode ? "Reset password" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {forgotMode
              ? "Enter your email and we'll send you a reset link."
              : "Log in to continue validating your ideas."}
          </p>
        </div>

        <Card className="animate-fade-in-up stagger-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            {/* Confirmation banners */}
            {confirmed && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-verdict-scale/30 bg-verdict-scale/5 px-3 py-2">
                <CheckCircle2 className="size-4 text-verdict-scale shrink-0" />
                <p className="text-sm text-verdict-scale">
                  Email confirmed! Please log in.
                </p>
              </div>
            )}
            {authError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">
                  Authentication failed. Please try logging in.
                </p>
              </div>
            )}

            {forgotMode ? (
              forgotSent ? (
                <div className="py-4 text-center animate-scale-in">
                  <CheckCircle2 className="mx-auto mb-3 size-10 text-verdict-scale" />
                  <p className="font-medium text-verdict-scale">
                    Check your email for a reset link.
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-sm text-muted-foreground underline hover:text-foreground transition-colors"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotSent(false);
                    }}
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <div>
                      <Label htmlFor="email" className="text-sm">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 text-base"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full gap-2 h-10"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </Button>
                  </form>
                  <button
                    type="button"
                    className="mt-3 flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground transition-colors"
                    onClick={() => {
                      setForgotMode(false);
                      setError("");
                    }}
                  >
                    <ArrowLeft className="size-3" />
                    Back to login
                  </button>
                </>
              )
            ) : (
              <>
                {/* OAuth buttons first */}
                <div className="flex flex-col gap-2 mb-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleOAuthLogin("google")}
                    className="w-full gap-2 h-10"
                  >
                    <svg className="size-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
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
                    className="w-full gap-2 h-10"
                  >
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    Continue with GitHub
                  </Button>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or log in with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label htmlFor="login-email" className="text-sm">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="mt-1 text-base"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-sm">
                        Password
                      </Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                        onClick={() => {
                          setForgotMode(true);
                          setError("");
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="mt-1 text-base"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all h-10"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Log in"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        {!forgotMode && (
          <p className="mt-4 text-center text-sm text-muted-foreground animate-fade-in-up stagger-3">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up
              <ArrowRight className="ml-0.5 inline size-3" />
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
