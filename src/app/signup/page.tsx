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

      {/* Decorative ink wash clouds -- animated drift */}
      <div
        className="pointer-events-none absolute left-[-10%] top-[10%] h-[400px] w-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--jade) 0%, transparent 70%)",
          opacity: mounted ? 0.06 : 0,
          transition: "opacity 1.5s ease-out 0.3s",
          animation: mounted ? "mist-drift 12s ease-in-out infinite" : "none",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[5%] right-[-5%] h-[350px] w-[450px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--cinnabar) 0%, transparent 70%)",
          opacity: mounted ? 0.07 : 0,
          transition: "opacity 1.5s ease-out 0.5s",
          animation: mounted ? "mist-drift 15s ease-in-out infinite reverse" : "none",
        }}
      />

      {/* Floating qi particles */}
      <div
        className="pointer-events-none absolute left-[20%] top-[30%] h-1.5 w-1.5 rounded-full bg-jade/30"
        style={{
          animation: mounted ? "float-particle 6s ease-in-out infinite alternate" : "none",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 0.8s",
        }}
      />
      <div
        className="pointer-events-none absolute right-[25%] top-[20%] h-1 w-1 rounded-full bg-spirit-gold/25"
        style={{
          animation: mounted ? "float-particle 8s ease-in-out infinite alternate-reverse" : "none",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 1s",
        }}
      />
      <div
        className="pointer-events-none absolute left-[15%] bottom-[25%] h-1 w-1 rounded-full bg-cinnabar/20"
        style={{
          animation: mounted ? "float-particle 7s ease-in-out infinite alternate" : "none",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 1.2s",
        }}
      />

      <div
        className="relative z-10 w-full max-w-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          filter: mounted ? "blur(0)" : "blur(6px)",
          transition: "opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header with cinnabar seal stamp */}
        <div className="mb-10 text-center">
          {/* Cinnabar seal mark -- proper stamp with border pattern */}
          <div
            className="mx-auto mb-6 relative"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "scale(1) rotate(0deg)" : "scale(1.4) rotate(-8deg)",
              transition: "opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s",
            }}
          >
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-md border-2 border-cinnabar/40 bg-cinnabar-dim shadow-[inset_0_0_20px_var(--cinnabar-dim)]">
              {/* Inner border for authentic seal look */}
              <div className="absolute inset-1.5 rounded-sm border border-cinnabar/20" />
              <span className="font-heading text-3xl font-bold text-cinnabar text-glow-cinnabar drop-shadow-[0_0_8px_var(--cinnabar-dim)]">
                仙
              </span>
            </div>
            {/* Seal ink bleed effect */}
            <div
              className="absolute -inset-2 rounded-lg opacity-30"
              style={{
                background: "radial-gradient(circle at center, var(--cinnabar-dim) 0%, transparent 70%)",
              }}
            />
          </div>

          <h1
            className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
              transition: "opacity 0.6s ease-out 0.25s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.25s",
            }}
          >
            踏入修仙界
          </h1>
          <p
            className="mt-3 text-base text-muted-foreground"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 0.6s ease-out 0.4s",
            }}
          >
            Create your account and begin your cultivation journey
          </p>

          {/* Decorative brush stroke divider */}
          <div
            className="mx-auto mt-5 h-px w-24"
            style={{
              background: "linear-gradient(90deg, transparent 0%, var(--cinnabar) 50%, transparent 100%)",
              opacity: mounted ? 0.4 : 0,
              clipPath: mounted ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
              transition: "opacity 0.5s ease-out 0.5s, clip-path 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.5s",
            }}
          />
        </div>

        {/* Signup Card -- elevated scroll surface */}
        <Card
          className="scroll-surface border-border/50 backdrop-blur-sm overflow-hidden"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
            transition: "opacity 0.6s ease-out 0.35s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.35s",
          }}
        >
          {/* Subtle top edge glow */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent 0%, var(--cinnabar) 50%, transparent 100%)",
              opacity: 0.25,
            }}
          />

          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg tracking-wide">Create Account</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              Sign up with your email to start cultivating
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email" className="text-sm font-medium text-foreground/80">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="email"
                  autoFocus
                  className="h-11 text-[16px] border-border/60 bg-background/50 transition-all duration-200 focus-visible:shadow-[0_0_16px_var(--cinnabar-dim)] focus-visible:border-cinnabar/30 hover:border-border"
                />
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password" className="text-sm font-medium text-foreground/80">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-11 text-[16px] border-border/60 bg-background/50 transition-all duration-200 focus-visible:shadow-[0_0_16px_var(--cinnabar-dim)] focus-visible:border-cinnabar/30 hover:border-border"
                />
              </div>

              {/* Confirm password field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-confirm" className="text-sm font-medium text-foreground/80">Confirm Password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-11 text-[16px] border-border/60 bg-background/50 transition-all duration-200 focus-visible:shadow-[0_0_16px_var(--cinnabar-dim)] focus-visible:border-cinnabar/30 hover:border-border"
                />
              </div>

              {/* Error message */}
              {errorMessage && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              {/* Success message */}
              {formState === "success" && (
                <div
                  className="rounded-lg border border-jade/30 bg-jade-dim px-3 py-2.5 text-sm text-jade"
                  role="status"
                >
                  Account created successfully. Entering the cultivation world...
                </div>
              )}

              {/* Submit button -- prominent CTA with seal glow */}
              <Button
                type="submit"
                size="lg"
                disabled={formState === "submitting" || formState === "success"}
                className="h-12 mt-1 text-base font-medium tracking-wide seal-glow transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_0_30px_var(--cinnabar-dim),0_0_60px_oklch(0.62_0.20_25/8%)] active:scale-[0.99] active:shadow-[0_0_10px_var(--cinnabar-dim)]"
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

            <Separator className="my-6 opacity-30" />

            {/* Login link */}
            <p className="text-center text-sm text-muted-foreground">
              Already a cultivator?{" "}
              <Link
                href="/login"
                className="font-medium text-cinnabar underline-offset-4 transition-all duration-200 hover:text-cinnabar/80 hover:underline hover:drop-shadow-[0_0_6px_var(--cinnabar-dim)]"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Bottom decorative proverb with brush stroke animation */}
        <div
          className="mt-8 flex flex-col items-center gap-2"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease-out 0.7s",
          }}
        >
          <div
            className="h-px w-12"
            style={{
              background: "linear-gradient(90deg, transparent, var(--ink-3), transparent)",
              opacity: 0.4,
            }}
          />
          <p className="font-heading text-sm text-ink-3/70 tracking-widest">
            修仙之路，始於今日
          </p>
        </div>
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
