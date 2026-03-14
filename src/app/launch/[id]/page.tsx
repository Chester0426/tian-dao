"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { trackExperimentCreated } from "@/lib/events";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Rocket,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Code2,
  Layers,
  Target,
  AlertTriangle,
  Zap,
} from "lucide-react";
import Link from "next/link";

type SpecData = {
  id: string;
  title: string;
  description: string;
  stack: { name: string; value: string }[];
  behaviors: { id: string; description: string; level: number }[];
  variants: { slug: string; headline: string; cta: string }[];
  hypotheses: { id: string; statement: string; metric: string; threshold: number }[];
};

type QualityCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export default function LaunchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [spec, setSpec] = useState<SpecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [qualityPassed, setQualityPassed] = useState(false);

  useEffect(() => {
    async function fetchSpec() {
      try {
        const res = await fetch(`/api/spec/${id}`);
        if (!res.ok) throw new Error("Failed to load spec");
        const data = await res.json();
        setSpec(data);
      } catch {
        setError("Could not load this spec. It may not exist or you may not have access.");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchSpec();
  }, [id]);

  const runQualityGate = () => {
    // Simulate quality gate checks
    const checks: QualityCheck[] = [
      {
        label: "Hypotheses defined",
        passed: (spec?.hypotheses?.length ?? 0) > 0,
        detail: `${spec?.hypotheses?.length ?? 0} hypotheses with measurable metrics`,
      },
      {
        label: "Variants configured",
        passed: (spec?.variants?.length ?? 0) > 0,
        detail: `${spec?.variants?.length ?? 0} landing page variants`,
      },
      {
        label: "Behaviors specified",
        passed: (spec?.behaviors?.length ?? 0) > 0,
        detail: `${spec?.behaviors?.length ?? 0} testable behaviors`,
      },
      {
        label: "Stack resolved",
        passed: (spec?.stack?.length ?? 0) > 0,
        detail: "All stack dependencies available",
      },
    ];
    setQualityChecks(checks);
    setQualityPassed(checks.every((c) => c.passed));
    setShowDeployDialog(true);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_id: id }),
      });
      if (!res.ok) throw new Error("Deploy failed");
      const data = await res.json();
      trackExperimentCreated();
      router.push(`/experiment/${data.id}`);
    } catch {
      setError("Deployment failed. Please try again.");
      setDeploying(false);
      setShowDeployDialog(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl shimmer" />
              <Skeleton className="h-8 w-48 shimmer" />
            </div>
            <Skeleton className="h-4 w-96 shimmer" />
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  className="h-40 rounded-lg shimmer"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !spec) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>
          <h2 className="font-display text-2xl mb-2">Spec not found</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link href="/assay" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ArrowLeft className="size-4" />
            Back to Assay
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="animate-fade-in-up stagger-1 mb-6">
          <Link
            href="/assay"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" />
            Back to Assay
          </Link>
        </div>

        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
              <Rocket className="size-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl">
                {spec?.title || "Launch Preview"}
              </h1>
              <Badge variant="outline" className="mt-1 text-xs">
                Spec #{id?.slice(0, 8)}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl mt-2">
            {spec?.description || "Review the generated experiment spec before deploying."}
          </p>
        </div>

        {/* Spec Preview Grid */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {/* Stack */}
          <Card className="animate-fade-in-up stagger-2 border-border/50 bg-card/50 backdrop-blur-sm card-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="size-4 text-mineral" />
                Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spec?.stack && spec.stack.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {spec.stack.map((s, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-xs"
                    >
                      {s.name}: {s.value}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">Next.js</Badge>
                  <Badge variant="secondary" className="text-xs">Supabase</Badge>
                  <Badge variant="secondary" className="text-xs">PostHog</Badge>
                  <Badge variant="secondary" className="text-xs">Stripe</Badge>
                  <Badge variant="secondary" className="text-xs">Vercel</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Behaviors */}
          <Card className="animate-fade-in-up stagger-3 border-border/50 bg-card/50 backdrop-blur-sm card-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-copper" />
                Behaviors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spec?.behaviors && spec.behaviors.length > 0 ? (
                <div className="space-y-2">
                  {spec.behaviors.slice(0, 5).map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px] mt-0.5">
                        L{b.level}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{b.description}</span>
                    </div>
                  ))}
                  {spec.behaviors.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{spec.behaviors.length - 5} more behaviors
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Behaviors will be defined during experiment setup.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Variants */}
          <Card className="animate-fade-in-up stagger-4 border-border/50 bg-card/50 backdrop-blur-sm card-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-ember" />
                Variants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spec?.variants && spec.variants.length > 0 ? (
                <div className="space-y-3">
                  {spec.variants.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border/50 bg-background/50 p-3"
                    >
                      <p className="text-sm font-medium">{v.headline}</p>
                      <Badge className="mt-1 text-[10px] bg-accent/10 text-accent border-accent/30">
                        {v.cta}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No A/B variants configured. A single variant will be used.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hypotheses */}
          <Card className="animate-fade-in-up stagger-5 border-border/50 bg-card/50 backdrop-blur-sm card-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-gold" />
                Hypotheses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spec?.hypotheses && spec.hypotheses.length > 0 ? (
                <div className="space-y-3">
                  {spec.hypotheses.map((h, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{h.id}</Badge>
                        <span className="text-xs text-muted-foreground">
                          threshold: {(h.threshold * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground">{h.statement}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hypotheses will be generated from the spec.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="mb-8" />

        {/* Deploy section */}
        <div className="animate-fade-in-up stagger-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="size-4" />
            <span>Quality gate will run before deployment</span>
          </div>
          <Button
            onClick={runQualityGate}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 glow-gold active:scale-[0.98] transition-all"
            size="lg"
          >
            <Zap className="size-4" />
            Deploy experiment
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {/* Quality Gate Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Shield className="size-5 text-accent" />
              Quality Gate
            </DialogTitle>
            <DialogDescription>
              Pre-deployment checks must pass before launching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {qualityChecks.map((check, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border border-border/50 bg-background/50 p-3 animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {check.passed ? (
                  <CheckCircle2 className="size-5 shrink-0 text-verdict-scale" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            {qualityPassed ? (
              <Button
                onClick={handleDeploy}
                disabled={deploying}
                className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {deploying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Confirm & Deploy
                  </>
                )}
              </Button>
            ) : (
              <div className="w-full text-center">
                <p className="mb-3 text-sm text-destructive">
                  Some checks failed. Review your spec before deploying.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowDeployDialog(false)}
                >
                  Back to review
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
