"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { trackExperimentCreated } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SpecData {
  id: string;
  name: string;
  description: string;
  stack: { runtime: string; hosting: string; database: string };
  behaviors: { id: string; given: string; when: string; then: string }[];
  variants: { slug: string; headline: string }[];
  hypotheses: { id: string; statement: string; threshold: number }[];
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function LaunchSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          className="border-border/50 bg-card/50"
        >
          <CardHeader>
            <div className="h-5 w-40 animate-skeleton rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-full animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
            <div className="h-4 w-3/4 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
            <div className="h-4 w-1/2 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 200}ms` }} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function LaunchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [spec, setSpec] = useState<SpecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    async function fetchSpec() {
      try {
        const res = await fetch(`/api/spec/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setSpec(data);
        }
      } catch (err) {
        console.error("Failed to load spec:", err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchSpec();
  }, [params.id]);

  async function handleDeploy() {
    if (!spec) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_id: spec.id }),
      });
      if (res.ok) {
        const data = await res.json();
        trackExperimentCreated({
          experiment_id: data.id,
          level: 3,
        });
        router.push(`/experiment/${data.id}`);
      }
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            Launch experiment
          </h1>
          {spec && (
            <Badge variant="secondary" className="text-xs">
              Draft
            </Badge>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Review your experiment configuration before deploying. Verify the
          stack, behaviors, variants, and hypotheses are correct.
        </p>
      </div>

      {loading ? (
        <LaunchSkeleton />
      ) : !spec ? (
        /* Empty state */
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gold/50">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="font-display text-lg tracking-tight text-muted-foreground">
            Spec not found
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground/60">
            This spec may have been removed or you don&apos;t have access.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push("/assay")}
          >
            Create a new spec
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Card */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h2 className="font-display text-xl tracking-tight">
                {spec.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {spec.description}
              </p>
            </CardContent>
          </Card>

          {/* Stack Card */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(spec.stack).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="capitalize">
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Behaviors */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                Behaviors
                <Badge variant="outline" className="ml-auto text-xs">
                  {spec.behaviors.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full">
                {spec.behaviors.map((b) => (
                  <AccordionItem key={b.id} value={b.id}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {b.id}
                        </Badge>
                        {b.when}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Given: </span>
                          {b.given}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">When: </span>
                          {b.when}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Then: </span>
                          {b.then}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Variants */}
          {spec.variants.length > 0 && (
            <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                  Variants
                  <Badge variant="outline" className="ml-auto text-xs">
                    {spec.variants.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {spec.variants.map((v) => (
                    <div
                      key={v.slug}
                      className="rounded-lg border border-border/30 bg-background/50 p-4 transition-all hover:border-gold/20 hover:shadow-[0_0_12px_var(--glow-gold)]"
                    >
                      <Badge variant="outline" className="mb-2 font-mono text-xs">
                        {v.slug}
                      </Badge>
                      <p className="text-sm font-medium">{v.headline}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hypotheses */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Hypotheses
                <Badge variant="outline" className="ml-auto text-xs">
                  {spec.hypotheses.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {spec.hypotheses.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-3 rounded-lg border border-border/20 bg-background/30 p-3 transition-colors hover:border-border/40"
                  >
                    <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-xs">
                      {h.id}
                    </Badge>
                    <div className="space-y-1">
                      <p className="text-sm">{h.statement}</p>
                      <p className="text-xs text-muted-foreground">
                        Threshold: {(h.threshold * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator className="my-4" />

          {/* Deploy CTA */}
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gold/20 bg-gold/5 p-8 text-center animate-fade-in-up stagger-5">
            <h3 className="font-display text-xl tracking-tight">
              Ready to deploy?
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              This will create your experiment and begin the deployment
              pipeline. You can monitor progress on the experiment page.
            </p>
            <Button
              onClick={handleDeploy}
              disabled={deploying}
              size="lg"
              className="bg-gold text-accent-foreground hover:bg-gold-bright animate-glow-breathe"
            >
              {deploying ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Deploying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4z" />
                  </svg>
                  Deploy experiment
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
