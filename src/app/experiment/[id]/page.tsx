"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { trackExperimentViewed } from "@/lib/events";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Activity,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Eye,
  Users,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

type HypothesisStatus = "passing" | "failing" | "pending" | "inconclusive";

type Hypothesis = {
  id: string;
  category: string;
  statement: string;
  metric_formula: string;
  threshold: number;
  current_value: number | null;
  status: HypothesisStatus;
  confidence: number;
};

type FunnelMetric = {
  stage: string;
  label: string;
  count: number;
  conversion_rate: number | null;
  icon: React.ReactNode;
};

type Experiment = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  created_at: string;
  days_running: number;
  hypotheses: Hypothesis[];
  funnel: FunnelMetric[];
  total_spend: number;
  total_impressions: number;
};

function hypothesisIcon(status: HypothesisStatus) {
  switch (status) {
    case "passing":
      return <CheckCircle2 className="size-5 text-verdict-scale" />;
    case "failing":
      return <XCircle className="size-5 text-verdict-kill" />;
    case "inconclusive":
      return <MinusCircle className="size-5 text-verdict-pivot" />;
    default:
      return <Clock className="size-5 text-muted-foreground" />;
  }
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    running: "bg-verdict-scale/10 text-verdict-scale border-verdict-scale/30",
    paused: "bg-verdict-refine/10 text-verdict-refine border-verdict-refine/30",
    completed: "bg-mineral/10 text-mineral border-mineral/30",
    draft: "bg-muted text-muted-foreground border-border",
  };
  return variants[status] ?? variants.draft;
}

export default function ExperimentPage() {
  const params = useParams();
  const id = params.id as string;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [changeType, setChangeType] = useState("pivot_variant");
  const [changeDescription, setChangeDescription] = useState("");
  const [changeBudget, setChangeBudget] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);

  useEffect(() => {
    async function fetchExperiment() {
      try {
        const res = await fetch(`/api/experiments/${id}`);
        if (!res.ok) throw new Error("Failed to load experiment");
        const data = await res.json();
        setExperiment(data);
        trackExperimentViewed({ experiment_id: id });
      } catch {
        setError("Could not load this experiment.");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchExperiment();
  }, [id]);

  async function handleSubmitChange() {
    setSubmittingChange(true);
    try {
      const res = await fetch(`/api/experiments/${id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: changeType,
          description: changeDescription,
          budget_delta: changeBudget ? Number(changeBudget) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit change");
      setChangeSuccess(true);
      setTimeout(() => {
        setShowChangeDialog(false);
        setChangeSuccess(false);
        setChangeDescription("");
        setChangeBudget("");
      }, 1500);
    } catch {
      setError("Failed to submit change request.");
    } finally {
      setSubmittingChange(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64 shimmer" />
            <Skeleton className="h-4 w-96 shimmer stagger-2" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  className="h-24 rounded-lg shimmer"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 rounded-lg shimmer stagger-5" />
              <Skeleton className="h-64 rounded-lg shimmer stagger-6" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !experiment) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>
          <h2 className="font-display text-2xl mb-2">Experiment not found</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link href="/lab" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
        </div>
      </main>
    );
  }

  // Default mock data for demonstration
  const exp = experiment ?? {
    id,
    name: "Experiment",
    status: "running" as const,
    created_at: new Date().toISOString(),
    days_running: 0,
    hypotheses: [],
    funnel: [],
    total_spend: 0,
    total_impressions: 0,
  };

  const funnelData: FunnelMetric[] = exp.funnel.length > 0 ? exp.funnel : [
    { stage: "reach", label: "Visitors", count: 0, conversion_rate: null, icon: <Eye className="size-4" /> },
    { stage: "demand", label: "Signups", count: 0, conversion_rate: 0, icon: <Users className="size-4" /> },
    { stage: "activate", label: "Activated", count: 0, conversion_rate: 0, icon: <Activity className="size-4" /> },
    { stage: "monetize", label: "Paid", count: 0, conversion_rate: 0, icon: <CreditCard className="size-4" /> },
  ];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="animate-fade-in-up stagger-1 mb-4">
          <Link
            href="/lab"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" />
            Lab
          </Link>
        </div>

        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-3xl md:text-4xl">{exp.name}</h1>
              <Badge className={`text-xs border ${statusBadge(exp.status)}`}>
                {exp.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {exp.days_running} days running
              </span>
              <span>ID: {id?.slice(0, 8)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowChangeDialog(true)}
            >
              <RefreshCw className="size-3.5" />
              Request change
            </Button>
            {exp.status === "completed" && (
              <Link href={`/verdict/${id}`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5 bg-accent text-accent-foreground")}>
                View verdict
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Funnel metrics strip */}
        <div className="animate-fade-in-up stagger-2 mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {funnelData.map((metric, i) => (
            <Card
              key={metric.stage}
              className="border-border/50 bg-card/50 backdrop-blur-sm card-lift animate-fade-in-up"
              style={{ animationDelay: `${(i + 2) * 80}ms` }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <span className="text-muted-foreground">{metric.icon}</span>
                </div>
                <p className="font-display text-2xl">
                  {metric.count.toLocaleString()}
                </p>
                {metric.conversion_rate !== null && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {metric.conversion_rate >= 5 ? (
                      <TrendingUp className="size-3 text-verdict-scale" />
                    ) : (
                      <TrendingDown className="size-3 text-verdict-kill" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {metric.conversion_rate.toFixed(1)}% conversion
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: Hypotheses / Details */}
        <Tabs defaultValue="hypotheses" className="animate-fade-in-up stagger-4">
          <TabsList className="mb-4">
            <TabsTrigger value="hypotheses" className="gap-1.5">
              <Target className="size-3.5" />
              Hypotheses
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="size-3.5" />
              Overview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hypotheses">
            {exp.hypotheses.length > 0 ? (
              <div className="space-y-3">
                {exp.hypotheses.map((h, i) => (
                  <Card
                    key={h.id}
                    className="border-border/50 bg-card/50 backdrop-blur-sm card-lift animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-start gap-3">
                        {hypothesisIcon(h.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">{h.id}</Badge>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {h.category}
                            </Badge>
                          </div>
                          <p className="text-sm mb-3">{h.statement}</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                Current: {h.current_value !== null ? `${(h.current_value * 100).toFixed(1)}%` : "N/A"}
                              </span>
                              <span>Threshold: {(h.threshold * 100).toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={h.current_value !== null ? Math.min((h.current_value / h.threshold) * 100, 100) : 0}
                              className="h-1.5"
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Confidence: {h.confidence}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Empty state */
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
                    <Target className="size-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl mb-2">No data yet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                    Hypothesis results will appear here once your experiment starts
                    collecting data. This usually takes 24-48 hours after deployment.
                  </p>
                  <Link href="/lab" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                    <ArrowLeft className="size-4" />
                    Back to Lab
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="size-4 text-gold" />
                    Experiment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Spend</span>
                      <span className="font-medium">${(exp.total_spend / 100).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Impressions</span>
                      <span className="font-medium">{exp.total_impressions.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Running</span>
                      <span className="font-medium">{exp.days_running}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={`text-xs border ${statusBadge(exp.status)}`}>
                        {exp.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="size-4 text-mineral" />
                    Funnel Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {funnelData.length > 0 ? (
                    <div className="space-y-3">
                      {funnelData.map((f, i) => (
                        <div key={f.stage}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground capitalize">{f.stage}</span>
                            <span className="font-medium">{f.count.toLocaleString()}</span>
                          </div>
                          <Progress
                            value={funnelData[0].count > 0 ? (f.count / funnelData[0].count) * 100 : 0}
                            className="h-1.5"
                          />
                          {i < funnelData.length - 1 && <Separator className="mt-3" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No funnel data yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change Request Dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Request a change</DialogTitle>
            <DialogDescription>
              Pivot a variant, adjust budget, or extend the timeline.
            </DialogDescription>
          </DialogHeader>

          {changeSuccess ? (
            <div className="py-6 text-center animate-scale-in">
              <CheckCircle2 className="mx-auto mb-3 size-10 text-verdict-scale" />
              <p className="font-medium">Change request submitted</p>
              <p className="text-sm text-muted-foreground">
                Your change will be applied shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="change-type" className="mb-1.5 block text-sm">
                    Change type
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "pivot_variant", label: "Pivot variant" },
                      { value: "adjust_budget", label: "Adjust budget" },
                      { value: "extend_timeline", label: "Extend timeline" },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={changeType === opt.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setChangeType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {changeType === "adjust_budget" && (
                  <div>
                    <Label htmlFor="budget" className="mb-1.5 block text-sm">
                      New daily budget ($)
                    </Label>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="50"
                      value={changeBudget}
                      onChange={(e) => setChangeBudget(e.target.value)}
                      className="text-base"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="change-desc" className="mb-1.5 block text-sm">
                    Description
                  </Label>
                  <Textarea
                    id="change-desc"
                    placeholder="Describe what you want to change and why..."
                    value={changeDescription}
                    onChange={(e) => setChangeDescription(e.target.value)}
                    className="min-h-[80px] text-base"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleSubmitChange}
                  disabled={submittingChange || !changeDescription.trim()}
                  className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {submittingChange ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Submit change request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
