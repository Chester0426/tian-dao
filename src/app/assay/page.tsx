"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { trackSpecGenerated, trackSignupStart, trackSignupComplete, trackActivate } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Beaker,
  Sparkles,
  Send,
  Save,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

type SpecSection = {
  title: string;
  content: string;
};

type GenerationState = "idle" | "streaming" | "complete" | "error";

export default function AssayPage() {
  const [idea, setIdea] = useState("");
  const [specSections, setSpecSections] = useState<SpecSection[]>([]);
  const [streamText, setStreamText] = useState("");
  const [genState, setGenState] = useState<GenerationState>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "launch" | null>(null);
  const [specId, setSpecId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: import("@supabase/supabase-js").User } | null } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: import("@supabase/supabase-js").User } | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-scroll stream output
  useEffect(() => {
    if (streamRef.current && genState === "streaming") {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText, genState]);

  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || genState === "streaming") return;

    setGenState("streaming");
    setStreamText("");
    setSpecSections([]);
    setSpecId(null);

    const generationStartTime = Date.now();

    try {
      const response = await fetch("/api/spec/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate spec");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullText = "";

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
                fullText += parsed.text;
                setStreamText(fullText);
              }
              if (parsed.spec_id) {
                setSpecId(parsed.spec_id);
              }
              if (parsed.sections) {
                setSpecSections(parsed.sections);
              }
            } catch {
              // Skip non-JSON lines
              fullText += data;
              setStreamText(fullText);
            }
          }
        }
      }

      setGenState("complete");
      const isAnonymous = !user;
      const generationTimeMs = Date.now() - generationStartTime;
      trackSpecGenerated({ idea_length: idea.trim().length, anonymous: isAnonymous, generation_time_ms: generationTimeMs });
      trackActivate({ action: "spec_generated" });
    } catch {
      setGenState("error");
    }
  }, [idea, genState, user]);

  const handleSaveOrLaunch = (action: "save" | "launch") => {
    if (!user) {
      setPendingAction(action);
      setShowSignupModal(true);
      return;
    }
    if (action === "launch" && specId) {
      router.push(`/launch/${specId}`);
    }
  };

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupPassword.length < 8) {
      setSignupError("Password must be at least 8 characters");
      return;
    }
    setSignupLoading(true);
    setSignupError("");
    trackSignupStart({ method: "email" });

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSignupLoading(false);

    if (authError) {
      setSignupError(authError.message);
      return;
    }
    if (data.user?.identities?.length === 0) {
      setSignupError("An account with this email already exists. Please log in.");
      return;
    }
    if (!data.session) {
      setSignupSuccess("Check your email for a confirmation link.");
      return;
    }

    trackSignupComplete({ method: "email" });

    // Claim spec if we have one
    if (specId) {
      await fetch("/api/spec/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_id: specId }),
      });
    }

    setShowSignupModal(false);
    if (pendingAction === "launch" && specId) {
      router.push(`/launch/${specId}`);
    }
  }

  async function handleOAuthLogin(provider: "google" | "github") {
    trackSignupStart({ method: provider });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  const exampleIdeas = [
    "An AI tool that writes cold emails that actually get replies",
    "A marketplace connecting home chefs with local food lovers",
    "A browser extension that summarizes any webpage in 3 bullet points",
  ];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
              <Beaker className="size-5 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Assay your idea</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Describe your startup idea below. Our AI will generate a testable experiment
            spec with hypotheses, metrics, and a deployment plan.
          </p>
        </div>

        {/* Idea Input */}
        <div className="animate-fade-in-up stagger-2 mb-8">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <Label htmlFor="idea" className="mb-2 block text-sm font-medium text-muted-foreground">
                Your idea
              </Label>
              <Textarea
                ref={textareaRef}
                id="idea"
                placeholder="Describe your startup idea in a few sentences. What problem does it solve? Who is it for?"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className="min-h-[120px] resize-none border-border/50 bg-background/50 text-base placeholder:text-muted-foreground/60 focus:ring-ring"
                maxLength={10000}
                disabled={genState === "streaming"}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {idea.length.toLocaleString()} / 10,000
                </span>
                <Button
                  onClick={handleGenerate}
                  disabled={!idea.trim() || genState === "streaming"}
                  className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all"
                  size="lg"
                >
                  {genState === "streaming" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Test it
                    </>
                  )}
                </Button>
              </div>

              {/* Example prompts */}
              {genState === "idle" && !idea && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Lightbulb className="size-3" />
                    Try an example
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {exampleIdeas.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setIdea(ex)}
                        className="rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {ex.length > 50 ? ex.slice(0, 50) + "..." : ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Streaming Output */}
        {genState === "streaming" && (
          <div className="animate-fade-in-up mb-8">
            <Card className="border-accent/20 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="h-1 w-full overflow-hidden bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-r bg-accent" style={{ animation: "shimmer 1.8s ease-in-out infinite" }} />
              </div>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="animate-pulse-gold rounded-full p-1">
                    <Sparkles className="size-4 text-accent" />
                  </div>
                  <span className="text-sm font-medium text-accent">Generating spec...</span>
                </div>
                <div
                  ref={streamRef}
                  className="max-h-[400px] overflow-y-auto rounded-lg bg-background/50 p-4 font-mono text-sm leading-relaxed"
                >
                  {streamText || (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4 shimmer" />
                      <Skeleton className="h-4 w-1/2 shimmer" />
                      <Skeleton className="h-4 w-5/6 shimmer" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completed Spec */}
        {genState === "complete" && (
          <div className="animate-fade-in-up space-y-6">
            {/* Success banner */}
            <div className="flex items-center gap-3 rounded-lg border border-verdict-scale/30 bg-verdict-scale/5 px-4 py-3">
              <CheckCircle2 className="size-5 text-verdict-scale shrink-0" />
              <div>
                <p className="text-sm font-medium">Spec generated successfully</p>
                <p className="text-xs text-muted-foreground">
                  Review your experiment spec below, then save or launch it.
                </p>
              </div>
            </div>

            {/* Spec sections */}
            {specSections.length > 0 ? (
              <div className="grid gap-4">
                {specSections.map((section, i) => (
                  <Card
                    key={i}
                    className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up card-lift"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <CardContent className="p-4 md:p-6">
                      <h3 className="font-display text-xl mb-3">{section.title}</h3>
                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {section.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4 md:p-6">
                  <div className="rounded-lg bg-background/50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                    {streamText}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => handleSaveOrLaunch("save")}
                className="gap-2"
                size="lg"
              >
                <Save className="size-4" />
                Save to Lab
              </Button>
              <Button
                onClick={() => handleSaveOrLaunch("launch")}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 glow-gold active:scale-[0.98] transition-all"
                size="lg"
              >
                <Rocket className="size-4" />
                Launch experiment
                <ArrowRight className="size-4" />
              </Button>
            </div>

            {!user && !authLoading && (
              <p className="text-center text-sm text-muted-foreground">
                <Send className="inline size-3 mr-1" />
                Sign up to save your spec and launch experiments
              </p>
            )}
          </div>
        )}

        {/* Error state */}
        {genState === "error" && (
          <div className="animate-fade-in-up">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Generation failed</p>
                    <p className="text-xs text-muted-foreground">
                      Something went wrong. Please try again.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    className="ml-auto"
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Signup Modal for Anonymous Users */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Save your experiment
            </DialogTitle>
            <DialogDescription>
              Create an account to save your spec and launch live experiments.
            </DialogDescription>
          </DialogHeader>

          {signupSuccess ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-verdict-scale" />
              <p className="text-sm font-medium text-verdict-scale">{signupSuccess}</p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    className="text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={8}
                    className="text-base"
                  />
                </div>
                {signupError && (
                  <p className="text-sm text-destructive">{signupError}</p>
                )}
                <Button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {signupLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Sign up"
                  )}
                </Button>
              </form>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  className="w-full"
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleOAuthLogin("github")}
                  className="w-full"
                >
                  Continue with GitHub
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
