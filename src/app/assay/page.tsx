"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  trackSpecGenerated,
  trackSignupStart,
  trackSignupComplete,
  trackActivate,
} from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Signup Modal (b-04: anonymous save/launch triggers signup)
// ---------------------------------------------------------------------------
function SignupModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (open) {
      trackSignupStart({ method: "email" });
    }
  }, [open]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.user?.identities?.length === 0) {
      setError("An account with this email already exists. Please log in.");
      return;
    }
    if (!data.session) {
      setSuccess("Check your email for a confirmation link to complete signup.");
      return;
    }
    trackSignupComplete({ method: "email" });
    onSuccess();
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    trackSignupStart({ method: provider });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Save your experiment
          </DialogTitle>
          <DialogDescription>
            Create an account to save this spec and launch your experiment.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4 text-center">
            <div className="rounded-lg bg-verdict-scale/10 px-4 py-3 text-sm text-verdict-scale">
              {success}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* OAuth buttons */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleOAuthLogin("google")}
                className="w-full border-border/50 hover:border-gold/30"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => handleOAuthLogin("github")}
                className="w-full border-border/50 hover:border-gold/30"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
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

            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loader for Spec
// ---------------------------------------------------------------------------
function SpecSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-3" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="h-5 w-32 animate-skeleton rounded bg-muted" />
          <div className="h-4 w-full animate-skeleton rounded bg-muted" style={{ animationDelay: "0.1s" }} />
          <div className="h-4 w-3/4 animate-skeleton rounded bg-muted" style={{ animationDelay: "0.2s" }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spec Display
// ---------------------------------------------------------------------------
function SpecDisplay({ spec }: { spec: string }) {
  const sections = spec.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div
          key={i}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {section}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Assay Page
// ---------------------------------------------------------------------------
export default function AssayPage() {
  const [user, setUser] = useState<User | null>(null);
  const [idea, setIdea] = useState("");
  const [spec, setSpec] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "launch" | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Check auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: import("@supabase/supabase-js").User } | null } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: import("@supabase/supabase-js").User } | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-focus the input
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Generate spec via SSE (b-03)
  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || isGenerating) return;

    setIsGenerating(true);
    setSpec("");
    const startTime = Date.now();

    try {
      const response = await fetch("/api/spec/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to generate spec");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setSpec(accumulated);
              }
            } catch {
              // Non-JSON SSE data — append raw
              accumulated += data;
              setSpec(accumulated);
            }
          }
        }
      }

      const generationTimeMs = Date.now() - startTime;
      trackSpecGenerated({
        anonymous: !user,
        idea_length: idea.trim().length,
        generation_time_ms: generationTimeMs,
      });
      trackActivate({ action: "spec_generated" });
    } catch (err) {
      console.error("Spec generation failed:", err);
      setSpec("Failed to generate spec. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [idea, isGenerating, user]);

  // Handle save/launch for anonymous users (b-04)
  function handleSaveOrLaunch(action: "save" | "launch") {
    if (!user) {
      setPendingAction(action);
      setShowSignup(true);
      return;
    }
    if (action === "launch") {
      // Navigate to launch page — spec ID would come from API
      router.push("/launch/new");
    }
  }

  function handleSignupSuccess() {
    setShowSignup(false);
    if (pendingAction === "launch") {
      router.push("/launch/new");
    }
    setPendingAction(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Assay your idea
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Describe your startup idea and our AI will generate a testable
          experiment spec — complete with hypotheses, behaviors, and a
          validation plan.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Input column */}
        <div className="lg:col-span-2">
          <Card className="sticky top-24 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-gold"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                Your idea
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="idea" className="sr-only">
                  Describe your idea
                </Label>
                <textarea
                  ref={textareaRef}
                  id="idea"
                  placeholder="A tool that helps indie hackers validate startup ideas with real user data before building..."
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  className="min-h-[160px] w-full resize-none rounded-lg border border-input bg-background/50 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                  maxLength={10000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {idea.length.toLocaleString()} / 10,000 characters
                  </span>
                  {user && (
                    <Badge
                      variant="secondary"
                      className="text-xs text-verdict-scale"
                    >
                      Auto-saves to your account
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!idea.trim() || isGenerating}
                className="w-full bg-gold text-accent-foreground transition-all hover:bg-gold-bright disabled:opacity-50"
                size="lg"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Generating spec...
                  </span>
                ) : (
                  "Test it"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Spec output column */}
        <div className="lg:col-span-3">
          {!spec && !isGenerating ? (
            /* Empty state */
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-gold/50"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-display text-lg tracking-tight text-muted-foreground">
                Your experiment spec will appear here
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground/60">
                Enter your idea and click &quot;Test it&quot; to generate a
                testable experiment specification with hypotheses, behaviors,
                and a validation plan.
              </p>
            </div>
          ) : (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 text-gold"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Experiment Spec
                  </CardTitle>
                  {isGenerating && (
                    <Badge
                      variant="outline"
                      className="animate-gold-pulse border-gold/30 text-gold"
                    >
                      Generating...
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isGenerating && !spec ? (
                  <SpecSkeleton />
                ) : (
                  <SpecDisplay spec={spec} />
                )}

                {/* Action buttons (visible when spec is complete) */}
                {spec && !isGenerating && (
                  <div className="mt-8 flex flex-col gap-3 border-t border-border/30 pt-6 sm:flex-row">
                    <Button
                      onClick={() => handleSaveOrLaunch("save")}
                      variant="outline"
                      className="flex-1 border-border/50 hover:border-gold/30"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                      >
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save spec
                    </Button>
                    <Button
                      onClick={() => handleSaveOrLaunch("launch")}
                      className="flex-1 bg-gold text-accent-foreground hover:bg-gold-bright"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                      >
                        <path d="M22 2L11 13" />
                        <path d="M22 2l-7 20-4-9-9-4z" />
                      </svg>
                      Launch experiment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Signup Modal */}
      <SignupModal
        open={showSignup}
        onOpenChange={setShowSignup}
        onSuccess={handleSignupSuccess}
      />
    </div>
  );
}
