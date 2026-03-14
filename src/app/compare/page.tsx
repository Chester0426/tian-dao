"use client";

import { useState, useEffect } from "react";
import { trackExperimentViewed } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExperimentSummary {
  id: string;
  name: string;
  status: string;
  verdict: string | null;
  metrics: {
    visitors: number;
    signups: number;
    conversion_rate: number | null;
    activation_rate: number | null;
  };
  hypotheses: {
    id: string;
    statement: string;
    current_value: number;
    threshold: number;
    status: string;
  }[];
}

// ---------------------------------------------------------------------------
// Verdict colors
// ---------------------------------------------------------------------------
const VERDICT_COLOR: Record<string, string> = {
  scale: "text-verdict-scale",
  refine: "text-verdict-refine",
  pivot: "text-verdict-pivot",
  kill: "text-verdict-kill",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="h-10 w-48 animate-skeleton rounded-md bg-muted" />
        <div className="h-10 w-48 animate-skeleton rounded-md bg-muted" style={{ animationDelay: "0.1s" }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 animate-skeleton rounded-lg bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function ComparePage() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [selected, setSelected] = useState<[string, string]>(["", ""]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExperiments() {
      try {
        const res = await fetch("/api/experiments");
        if (res.ok) {
          const data = await res.json();
          const list = data.experiments ?? data ?? [];
          setExperiments(list);
          if (list.length >= 2) {
            setSelected([list[0].id, list[1].id]);
          } else if (list.length === 1) {
            setSelected([list[0].id, ""]);
          }
        }
      } catch (err) {
        console.error("Failed to load experiments:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExperiments();
  }, []);

  // Track views for each selected experiment
  useEffect(() => {
    selected.forEach((id) => {
      if (id) trackExperimentViewed({ experiment_id: id });
    });
  }, [selected]);

  const selectedExperiments = selected
    .map((id) => experiments.find((e) => e.id === id))
    .filter(Boolean) as ExperimentSummary[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Compare experiments
        </h1>
        <p className="mt-2 text-muted-foreground">
          Side-by-side comparison of funnel metrics, hypothesis results, and
          verdicts across your experiments.
        </p>
      </div>

      {loading ? (
        <CompareSkeleton />
      ) : experiments.length < 2 ? (
        /* Empty / insufficient state */
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center animate-fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gold/50" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <h3 className="font-display text-lg tracking-tight text-muted-foreground">
            Need at least two experiments
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground/60">
            Create more experiments to compare their performance side by side.
          </p>
          <a href="/assay">
            <Button variant="outline" className="mt-6">
              Create an experiment
            </Button>
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Selectors */}
          <div className="flex flex-col gap-4 sm:flex-row">
            {[0, 1].map((idx) => (
              <div key={idx} className="flex-1 space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Experiment {idx + 1}
                </Label>
                <select
                  value={selected[idx]}
                  onChange={(e) => {
                    const next = [...selected] as [string, string];
                    next[idx] = e.target.value;
                    setSelected(next);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Select experiment</option>
                  {experiments.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Comparison grid */}
          {selectedExperiments.length === 2 && (
            <div className="grid gap-6 sm:grid-cols-2">
              {selectedExperiments.map((exp, i) => (
                <Card
                  key={exp.id}
                  className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="font-display tracking-tight">{exp.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {exp.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Verdict */}
                    {exp.verdict && (
                      <div className="text-center">
                        <span
                          className={`font-display text-2xl tracking-wider ${
                            VERDICT_COLOR[exp.verdict] ?? ""
                          }`}
                        >
                          {exp.verdict.toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Visitors</p>
                        <p className="font-mono text-xl">
                          {exp.metrics.visitors.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Signups</p>
                        <p className="font-mono text-xl">
                          {exp.metrics.signups.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CVR</p>
                        <p className="font-mono text-xl">
                          {exp.metrics.conversion_rate !== null
                            ? `${(exp.metrics.conversion_rate * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Activation</p>
                        <p className="font-mono text-xl">
                          {exp.metrics.activation_rate !== null
                            ? `${(exp.metrics.activation_rate * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Hypotheses */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Hypotheses
                      </p>
                      {exp.hypotheses.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center gap-2 rounded-md bg-background/30 p-2"
                        >
                          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                            {h.id}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <Progress
                              value={Math.min(
                                (h.current_value / h.threshold) * 100,
                                100
                              )}
                              className="h-1"
                            />
                          </div>
                          <span
                            className={`text-[10px] font-medium ${
                              h.status === "passing"
                                ? "text-verdict-scale"
                                : h.status === "failing"
                                ? "text-verdict-kill"
                                : "text-muted-foreground"
                            }`}
                          >
                            {(h.current_value * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
