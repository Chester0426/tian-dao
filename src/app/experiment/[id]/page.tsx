"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  trackExperimentViewed,
  trackChangeRequestSubmitted,
} from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Hypothesis {
  id: string;
  statement: string;
  category: string;
  threshold: number;
  current_value: number | null;
  status: "pending" | "passing" | "failing" | "insufficient_data";
}

interface FunnelMetric {
  stage: string;
  event: string;
  count: number;
  conversion_rate: number | null;
}

interface ExperimentData {
  id: string;
  name: string;
  status: "draft" | "deploying" | "running" | "paused" | "completed";
  created_at: string;
  hypotheses: Hypothesis[];
  funnel: FunnelMetric[];
  alerts: { id: string; type: string; message: string; created_at: string }[];
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: ExperimentData["status"] }) {
  const styles: Record<string, string> = {
    draft: "border-muted-foreground/30 text-muted-foreground",
    deploying: "border-gold/30 text-gold animate-gold-pulse",
    running: "border-verdict-scale/30 text-verdict-scale",
    paused: "border-verdict-pivot/30 text-verdict-pivot",
    completed: "border-primary/30 text-primary",
  };
  return (
    <Badge variant="outline" className={styles[status] ?? ""}>
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Hypothesis Card
// ---------------------------------------------------------------------------
function HypothesisCard({ h }: { h: Hypothesis }) {
  const statusColors: Record<string, string> = {
    passing: "text-verdict-scale",
    failing: "text-verdict-kill",
    pending: "text-muted-foreground",
    insufficient_data: "text-muted-foreground",
  };

  const progress =
    h.current_value !== null ? Math.min((h.current_value / h.threshold) * 100, 100) : 0;

  return (
    <div className="rounded-lg border border-border/30 bg-background/30 p-4 transition-all hover:border-border/50 hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {h.id}
          </Badge>
          <Badge variant="outline" className="capitalize text-xs">
            {h.category}
          </Badge>
        </div>
        <span className={`text-xs font-medium uppercase ${statusColors[h.status]}`}>
          {h.status.replace("_", " ")}
        </span>
      </div>
      <p className="mb-3 text-sm">{h.statement}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {h.current_value !== null ? `${(h.current_value * 100).toFixed(1)}%` : "—"}
          </span>
          <span>Target: {(h.threshold * 100).toFixed(0)}%</span>
        </div>
        <Progress
          value={progress}
          className="h-1.5"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function ScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardContent className="pt-6">
              <div className="h-4 w-20 animate-skeleton rounded bg-muted" />
              <div className="mt-2 h-8 w-16 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
            </CardContent>
          </Card>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-skeleton rounded-lg bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function ExperimentPage() {
  const params = useParams<{ id: string }>();
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeType, setChangeType] = useState("adjust_budget");
  const [submittingChange, setSubmittingChange] = useState(false);

  useEffect(() => {
    async function fetchExperiment() {
      try {
        const res = await fetch(`/api/experiments/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setExperiment(data);
          trackExperimentViewed({ experiment_id: params.id });
        }
      } catch (err) {
        console.error("Failed to load experiment:", err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchExperiment();
  }, [params.id]);

  async function handleChangeRequest() {
    if (!experiment) return;
    setSubmittingChange(true);
    try {
      await fetch(`/api/experiments/${experiment.id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_type: changeType }),
      });
      trackChangeRequestSubmitted({
        experiment_id: experiment.id,
        change_type: changeType,
      });
      setChangeDialogOpen(false);
    } catch (err) {
      console.error("Change request failed:", err);
    } finally {
      setSubmittingChange(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            {experiment?.name ?? "Experiment scorecard"}
          </h1>
          {experiment && <StatusBadge status={experiment.status} />}
        </div>
        <p className="mt-2 text-muted-foreground">
          Live scorecard with funnel metrics, hypothesis status, and confidence
          intervals.
        </p>
      </div>

      {loading ? (
        <ScorecardSkeleton />
      ) : !experiment ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gold/50">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="font-display text-lg tracking-tight text-muted-foreground">
            Experiment not found
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground/60">
            This experiment may have been removed or you don&apos;t have access.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="scorecard" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts
              {experiment.alerts.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 w-5 rounded-full p-0 text-[10px]">
                  {experiment.alerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Scorecard Tab */}
          <TabsContent value="scorecard" className="space-y-6">
            {/* Summary metrics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up">
                <CardContent className="pt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Hypotheses
                  </p>
                  <p className="mt-1 font-display text-3xl tracking-tight">
                    {experiment.hypotheses.filter((h) => h.status === "passing").length}
                    <span className="text-lg text-muted-foreground">
                      /{experiment.hypotheses.length}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">passing</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up stagger-1">
                <CardContent className="pt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Funnel entries
                  </p>
                  <p className="mt-1 font-display text-3xl tracking-tight">
                    {experiment.funnel[0]?.count ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">total visitors</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in-up stagger-2">
                <CardContent className="pt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Running since
                  </p>
                  <p className="mt-1 font-display text-3xl tracking-tight">
                    {Math.floor(
                      (Date.now() - new Date(experiment.created_at).getTime()) /
                        86_400_000
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">days</p>
                </CardContent>
              </Card>
            </div>

            {/* Hypotheses */}
            <div className="space-y-3">
              <h2 className="font-display text-xl tracking-tight">Hypotheses</h2>
              {experiment.hypotheses.map((h, i) => (
                <div
                  key={h.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${(i + 3) * 80}ms` }}
                >
                  <HypothesisCard h={h} />
                </div>
              ))}
            </div>

            {/* Change request button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setChangeDialogOpen(true)}
                className="border-border/50 hover:border-gold/30"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Submit change request
              </Button>
            </div>
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <h2 className="font-display text-xl tracking-tight">
              Conversion funnel
            </h2>
            {experiment.funnel.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No funnel data yet. Metrics will appear once your experiment
                  receives traffic.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {experiment.funnel.map((m, i) => (
                  <div
                    key={m.stage}
                    className="flex items-center gap-4 rounded-lg border border-border/20 bg-background/30 p-4 transition-all hover:border-border/40 animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="w-28 shrink-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {m.stage}
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{m.event}</span>
                        <span className="font-mono">{m.count.toLocaleString()}</span>
                      </div>
                      <Progress
                        value={
                          m.conversion_rate !== null
                            ? m.conversion_rate * 100
                            : 0
                        }
                        className="mt-1.5 h-1.5"
                      />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm font-medium">
                        {m.conversion_rate !== null
                          ? `${(m.conversion_rate * 100).toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <h2 className="font-display text-xl tracking-tight">Alerts</h2>
            {experiment.alerts.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-verdict-scale/10">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-verdict-scale">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  No alerts. Everything is running smoothly.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {experiment.alerts.map((alert, i) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border border-verdict-pivot/20 bg-verdict-pivot/5 p-4 animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-verdict-pivot">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium">{alert.type}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Change Request Dialog */}
      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">
              Submit change request
            </DialogTitle>
            <DialogDescription>
              Request a change to your running experiment. Changes will be
              reviewed before execution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="change-type">Change type</Label>
              <select
                id="change-type"
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="adjust_budget">Adjust budget</option>
                <option value="extend_timeline">Extend timeline</option>
                <option value="pivot_variant">Pivot variant</option>
                <option value="pause">Pause experiment</option>
                <option value="resume">Resume experiment</option>
              </select>
            </div>
            <Button
              onClick={handleChangeRequest}
              disabled={submittingChange}
              className="w-full bg-gold text-accent-foreground hover:bg-gold-bright"
            >
              {submittingChange ? "Submitting..." : "Submit request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
