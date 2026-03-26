"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { trackSignupStart, trackSignupComplete } from "@/lib/events";
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

type FormState = "idle" | "submitting" | "success" | "error";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    trackSignupStart({ method: "email" });
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Please enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [email, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setFormState("submitting");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormState("error");
        setErrorMessage(error.message);
        return;
      }

      setFormState("success");
      trackSignupComplete({ method: "email" });

      // Brief delay to show success state before redirect
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch {
      setFormState("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="ink-noise relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 md:px-12">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 mist-gradient" />

      {/* Decorative ink wash clouds */}
      <div
        className="pointer-events-none absolute left-[-10%] top-[10%] h-[400px] w-[500px] rounded-full opacity-[0.04]"
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
          transition: "opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s ease-out",
        }}
      >
        {/* Header with decorative seal */}
        <div className="mb-8 text-center">
          {/* Cinnabar seal mark */}
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-cinnabar/20 bg-cinnabar-dim"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "scale(1) rotate(0deg)" : "scale(1.3) rotate(-5deg)",
              transition: "opacity 0.5s ease-out 0.15s, transform 0.5s ease-out 0.15s",
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
              transition: "opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s",
            }}
          >
            踏入修仙界
          </h1>
          <p
            className="mt-2 text-sm text-muted-foreground"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.5s ease-out 0.3s, transform 0.5s ease-out 0.3s",
            }}
          >
            Create your account and begin your cultivation journey
          </p>
        </div>

        {/* Signup Card */}
        <Card
          className="scroll-surface border-border/50 backdrop-blur-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.5s ease-out 0.35s, transform 0.5s ease-out 0.35s",
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg">Create Account</CardTitle>
            <CardDescription>
              Sign up with your email to start cultivating
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="email"
                  autoFocus
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              {/* Confirm password field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-10 text-[16px] transition-shadow duration-150 focus-visible:shadow-[0_0_12px_var(--cinnabar-dim)]"
                />
              </div>

              {/* Error message */}
              {errorMessage && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              {/* Success message */}
              {formState === "success" && (
                <div
                  className="rounded-lg border border-jade/30 bg-jade-dim px-3 py-2 text-sm text-jade"
                  role="status"
                >
                  Account created successfully. Entering the cultivation world...
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                size="lg"
                disabled={formState === "submitting" || formState === "success"}
                className="h-11 text-base font-medium transition-all duration-200 hover:seal-glow hover:scale-[1.01] active:scale-[0.99]"
              >
                {formState === "submitting" ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Creating Account...
                  </span>
                ) : formState === "success" ? (
                  <span className="flex items-center gap-2">
                    <SuccessCheck />
                    Welcome, Cultivator
                  </span>
                ) : (
                  "Begin Cultivation"
                )}
              </Button>
            </form>

            <Separator className="my-5 opacity-50" />

            {/* Login link */}
            <p className="text-center text-sm text-muted-foreground">
              Already a cultivator?{" "}
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
          修仙之路，始於今日
        </p>
      </div>
    </div>
  );
}

/** Ink-wash themed loading spinner */
function LoadingSpinner() {
  return (
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
  );
}

/** Success checkmark */
function SuccessCheck() {
  return (
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
  );
}
