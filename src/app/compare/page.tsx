"use client";

import { useState, useEffect } from "react";
import { trackExperimentViewed } from "@/lib/events";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  ArrowLeftRight,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Eye,
  CreditCard,
  FlaskConical,
  Plus,
} from "lucide-react";
import Link from "next/link";

type ExperimentSummary = {
  id: string;
  name: string;
  status: string;
  verdict: string | null;
};

type CompareData = {
  id: string;
  name: string;
  status: string;
  verdict: string | null;
  days_running: number;
  funnel: {
    visitors: number;
    signups: number;
    activated: number;
    paid: number;
  };
  conversion_rates: {
    signup: number;
    activation: number;
    payment: number;
  };
  hypotheses_passed: number;
  hypotheses_total: number;
};

function verdictBadgeClass(verdict: string | null) {
  if (!verdict) return "bg-muted text-muted-foreground border-border";
  const classes: Record<string, string> = {
    SCALE: "verdict-scale",
    REFINE: "verdict-refine",
    PIVOT: "verdict-pivot",
    KILL: "verdict-kill",
  };
  return classes[verdict] ?? "";
}

export default function ComparePage() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [leftData, setLeftData] = useState<CompareData | null>(null);
  const [rightData, setRightData] = useState<CompareData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(false);

  useEffect(() => {
    async function fetchExperiments() {
      try {
        const res = await fetch("/api/experiments");
        if (!res.ok) throw new Error("Failed to load experiments");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.experiments ?? [];
        setExperiments(list);
      } catch {
        // Keep empty
      } finally {
        setLoadingList(false);
      }
    }
    fetchExperiments();
  }, []);

  async function fetchCompareData(expId: string): Promise<CompareData | null> {
    try {
      const res = await fetch(`/api/experiments/${expId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!leftId && !rightId) return;
    setLoadingCompare(true);

    const promises: Promise<void>[] = [];

    if (leftId) {
      promises.push(
        fetchCompareData(leftId).then((d) => setLeftData(d))
      );
      trackExperimentViewed({ experiment_id: leftId });
    }
    if (rightId) {
      promises.push(
        fetchCompareData(rightId).then((d) => setRightData(d))
      );
      trackExperimentViewed({ experiment_id: rightId });
    }

    Promise.all(promises).finally(() => setLoadingCompare(false));
  }, [leftId, rightId]);

  const funnelMetrics = [
    { key: "visitors", label: "Visitors", icon: <Eye className="size-4" /> },
    { key: "signups", label: "Signups", icon: <Users className="size-4" /> },
    { key: "activated", label: "Activated", icon: <Activity className="size-4" /> },
    { key: "paid", label: "Paid", icon: <CreditCard className="size-4" /> },
  ] as const;

  const conversionMetrics = [
    { key: "signup", label: "Signup Rate" },
    { key: "activation", label: "Activation Rate" },
    { key: "payment", label: "Payment Rate" },
  ] as const;

  function renderMetricCell(data: CompareData | null, key: string) {
    if (!data) return <span className="text-muted-foreground">--</span>;
    const funnel = data.funnel as Record<string, number>;
    return <span className="font-medium">{(funnel[key] ?? 0).toLocaleString()}</span>;
  }

  function renderConversionCell(data: CompareData | null, key: string) {
    if (!data) return <span className="text-muted-foreground">--</span>;
    const rates = data.conversion_rates as Record<string, number>;
    const rate = rates[key] ?? 0;
    return (
      <div className="flex items-center gap-1.5">
        {rate >= 5 ? (
          <TrendingUp className="size-3 text-verdict-scale" />
        ) : rate > 0 ? (
          <TrendingDown className="size-3 text-verdict-kill" />
        ) : null}
        <span className="font-medium">{rate.toFixed(1)}%</span>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
              <ArrowLeftRight className="size-5 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Compare</h1>
          </div>
          <p className="text-muted-foreground">
            Select two experiments to compare funnel metrics, verdicts, and hypothesis results side by side.
          </p>
        </div>

        {/* Selectors */}
        <div className="animate-fade-in-up stagger-2 mb-8 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Experiment A
            </label>
            {loadingList ? (
              <Skeleton className="h-10 w-full shimmer" />
            ) : (
              <Select value={leftId} onValueChange={(v: string | null) => v && setLeftId(v)}>
                <SelectTrigger className="w-full bg-card/50 border-border/50">
                  <SelectValue placeholder="Select an experiment..." />
                </SelectTrigger>
                <SelectContent>
                  {experiments.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={e.id === rightId}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Experiment B
            </label>
            {loadingList ? (
              <Skeleton className="h-10 w-full shimmer" />
            ) : (
              <Select value={rightId} onValueChange={(v: string | null) => v && setRightId(v)}>
                <SelectTrigger className="w-full bg-card/50 border-border/50">
                  <SelectValue placeholder="Select an experiment..." />
                </SelectTrigger>
                <SelectContent>
                  {experiments.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={e.id === leftId}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Empty state -- no experiments */}
        {!loadingList && experiments.length === 0 && (
          <div className="animate-fade-in-up flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-muted">
              <FlaskConical className="size-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-2xl mb-2">No experiments to compare</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Create at least two experiments to compare their performance side by side.
            </p>
            <Link
              href="/assay"
              className={cn(buttonVariants(), "gap-2 bg-accent text-accent-foreground hover:bg-accent/90")}
            >
              <Plus className="size-4" />
              Create an experiment
            </Link>
          </div>
        )}

        {/* Empty state -- need to select */}
        {!loadingList && experiments.length > 0 && !leftId && !rightId && (
          <div className="animate-fade-in-up flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
              <ArrowLeftRight className="size-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl mb-2">Select experiments above</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Choose two experiments from the dropdowns to see a side-by-side comparison.
            </p>
          </div>
        )}

        {/* Loading comparison data */}
        {loadingCompare && (leftId || rightId) && (
          <div className="space-y-4">
            <Skeleton className="h-48 shimmer" />
            <Skeleton className="h-48 shimmer stagger-2" />
          </div>
        )}

        {/* Comparison view */}
        {(leftData || rightData) && !loadingCompare && (
          <div className="animate-fade-in-up stagger-3 space-y-6">
            {/* Verdict comparison */}
            <div className="grid gap-4 md:grid-cols-2">
              {[leftData, rightData].map((d, i) => (
                <Card
                  key={i}
                  className="border-border/50 bg-card/50 backdrop-blur-sm card-lift animate-fade-in-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {d?.name || "Not selected"}
                    </p>
                    {d?.verdict ? (
                      <>
                        <Badge className={`text-lg px-4 py-1 border ${verdictBadgeClass(d.verdict)}`}>
                          {d.verdict}
                        </Badge>
                        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                          <span>{d.days_running} days</span>
                          <span>
                            {d.hypotheses_passed}/{d.hypotheses_total} hypotheses passed
                          </span>
                        </div>
                      </>
                    ) : d ? (
                      <Badge variant="outline" className="text-sm px-3 py-0.5">
                        {d.status}
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground">--</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            {/* Funnel comparison */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4 text-gold" />
                  Funnel Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {funnelMetrics.map((m) => (
                    <div key={m.key}>
                      <div className="flex items-center gap-2 mb-2 text-sm">
                        <span className="text-muted-foreground">{m.icon}</span>
                        <span className="font-medium">{m.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-md bg-background/50 px-3 py-2 text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            {leftData?.name?.slice(0, 20) || "Experiment A"}
                          </p>
                          <p className="font-display text-xl">{renderMetricCell(leftData, m.key)}</p>
                        </div>
                        <div className="rounded-md bg-background/50 px-3 py-2 text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            {rightData?.name?.slice(0, 20) || "Experiment B"}
                          </p>
                          <p className="font-display text-xl">{renderMetricCell(rightData, m.key)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conversion rates */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="size-4 text-mineral" />
                  Conversion Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversionMetrics.map((m) => (
                    <div key={m.key}>
                      <p className="text-sm font-medium mb-2">{m.label}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-md bg-background/50 px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-1">
                            {leftData?.name?.slice(0, 20) || "A"}
                          </p>
                          {renderConversionCell(leftData, m.key)}
                          <Progress
                            value={leftData?.conversion_rates?.[m.key as keyof CompareData["conversion_rates"]] ?? 0}
                            className="mt-1.5 h-1"
                          />
                        </div>
                        <div className="rounded-md bg-background/50 px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-1">
                            {rightData?.name?.slice(0, 20) || "B"}
                          </p>
                          {renderConversionCell(rightData, m.key)}
                          <Progress
                            value={rightData?.conversion_rates?.[m.key as keyof CompareData["conversion_rates"]] ?? 0}
                            className="mt-1.5 h-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
