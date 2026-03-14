"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trackLabViewed } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Experiment {
  id: string;
  name: string;
  status: "draft" | "deploying" | "running" | "paused" | "completed";
  verdict: "scale" | "refine" | "pivot" | "kill" | null;
  created_at: string;
  metrics: {
    visitors: number;
    signups: number;
    conversion_rate: number | null;
  };
}

// ---------------------------------------------------------------------------
// Status styles
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  draft: "border-muted-foreground/30 text-muted-foreground",
  deploying: "border-gold/30 text-gold",
  running: "border-verdict-scale/30 text-verdict-scale",
  paused: "border-verdict-pivot/30 text-verdict-pivot",
  completed: "border-primary/30 text-primary",
};

const VERDICT_STYLES: Record<string, { color: string; label: string }> = {
  scale: { color: "text-verdict-scale", label: "SCALE" },
  refine: { color: "text-verdict-refine", label: "REFINE" },
  pivot: { color: "text-verdict-pivot", label: "PIVOT" },
  kill: { color: "text-verdict-kill", label: "KILL" },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function LabSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="border-border/50 bg-card/50">
          <CardContent className="space-y-3 pt-6">
            <div className="h-5 w-40 animate-skeleton rounded bg-muted" />
            <div className="h-4 w-24 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
            <div className="flex gap-4">
              <div className="h-8 w-16 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
              <div className="h-8 w-16 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 160}ms` }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experiment Card
// ---------------------------------------------------------------------------
function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const verdictStyle = experiment.verdict
    ? VERDICT_STYLES[experiment.verdict]
    : null;

  return (
    <Link href={experiment.verdict ? `/verdict/${experiment.id}` : `/experiment/${experiment.id}`}>
      <Card className="group h-full border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/20 hover:shadow-lg hover:shadow-glow-gold">
        <CardContent className="flex h-full flex-col pt-6">
          <div className="mb-3 flex items-start justify-between">
            <h3 className="font-display text-lg tracking-tight transition-colors group-hover:text-gold">
              {experiment.name}
            </h3>
            <Badge
              variant="outline"
              className={`shrink-0 text-xs ${STATUS_STYLES[experiment.status] ?? ""}`}
            >
              {experiment.status}
            </Badge>
          </div>

          {/* Verdict stamp if available */}
          {verdictStyle && (
            <div className="mb-3">
              <span className={`font-display text-sm font-medium tracking-wider ${verdictStyle.color}`}>
                {verdictStyle.label}
              </span>
            </div>
          )}

          {/* Metrics */}
          <div className="mt-auto flex items-end gap-6 border-t border-border/20 pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Visitors</p>
              <p className="font-mono text-lg">
                {experiment.metrics.visitors.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Signups</p>
              <p className="font-mono text-lg">
                {experiment.metrics.signups.toLocaleString()}
              </p>
            </div>
            {experiment.metrics.conversion_rate !== null && (
              <div>
                <p className="text-xs text-muted-foreground">CVR</p>
                <p className="font-mono text-lg">
                  {(experiment.metrics.conversion_rate * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Created {new Date(experiment.created_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function LabPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExperiments() {
      try {
        const res = await fetch("/api/experiments");
        if (res.ok) {
          const data = await res.json();
          setExperiments(data.experiments ?? data ?? []);
          trackLabViewed({
            experiment_count: (data.experiments ?? data ?? []).length,
          });
        }
      } catch (err) {
        console.error("Failed to load experiments:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExperiments();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between animate-fade-in-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            The Lab
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your portfolio of experiments. Track status, verdicts, and key
            metrics across all your ideas.
          </p>
        </div>
        <Link href="/assay">
          <Button className="bg-gold text-accent-foreground hover:bg-gold-bright">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New assay
          </Button>
        </Link>
      </div>

      {loading ? (
        <LabSkeleton />
      ) : experiments.length === 0 ? (
        /* Empty state */
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center animate-fade-in">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gold/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-gold/40" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="font-display text-xl tracking-tight">
            No experiments yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Start by assaying your first idea. Paste a description and our AI
            will generate a testable experiment spec.
          </p>
          <Link href="/assay">
            <Button className="mt-6 bg-gold text-accent-foreground hover:bg-gold-bright">
              Assay your first idea
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experiments.map((exp, i) => (
            <div
              key={exp.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ExperimentCard experiment={exp} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
