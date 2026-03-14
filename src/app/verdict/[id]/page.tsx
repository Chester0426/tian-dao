"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { trackVerdictDelivered } from "@/lib/events";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  BarChart3,
  Award,
} from "lucide-react";
import Link from "next/link";

type VerdictType = "SCALE" | "REFINE" | "PIVOT" | "KILL";

type HypothesisResult = {
  id: string;
  category: string;
  statement: string;
  threshold: number;
  actual: number;
  passed: boolean;
};

type ChannelROI = {
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  signups: number;
  cpa: number;
};

type VerdictData = {
  id: string;
  experiment_name: string;
  verdict: VerdictType;
  confidence: number;
  rationale: string;
  hypotheses: HypothesisResult[];
  distribution_roi: ChannelROI[];
  recommendation: string;
  created_at: string;
};

function verdictStyle(verdict: VerdictType) {
  switch (verdict) {
    case "SCALE":
      return {
        bg: "bg-verdict-scale/10",
        border: "border-verdict-scale/30",
        text: "text-verdict-scale",
        glow: "shadow-[0_0_40px_oklch(0.62_0.17_155/15%)]",
        className: "verdict-scale",
      };
    case "REFINE":
      return {
        bg: "bg-verdict-refine/10",
        border: "border-verdict-refine/30",
        text: "text-verdict-refine",
        glow: "shadow-[0_0_40px_oklch(0.78_0.155_75/15%)]",
        className: "verdict-refine",
      };
    case "PIVOT":
      return {
        bg: "bg-verdict-pivot/10",
        border: "border-verdict-pivot/30",
        text: "text-verdict-pivot",
        glow: "shadow-[0_0_40px_oklch(0.65_0.14_55/15%)]",
        className: "verdict-pivot",
      };
    case "KILL":
      return {
        bg: "bg-verdict-kill/10",
        border: "border-verdict-kill/30",
        text: "text-verdict-kill",
        glow: "shadow-[0_0_40px_oklch(0.55_0.22_25/15%)]",
        className: "verdict-kill",
      };
  }
}

export default function VerdictPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchVerdict() {
      try {
        const res = await fetch(`/api/experiments/${id}/verdict`);
        if (!res.ok) throw new Error("Failed to load verdict");
        const result = await res.json();
        setData(result);
        if (result.verdict) {
          trackVerdictDelivered({
            experiment_id: id,
            verdict: result.verdict,
          });
        }
      } catch {
        setError("Could not load the verdict for this experiment.");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchVerdict();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
          <div className="space-y-6">
            <Skeleton className="h-10 w-48 shimmer" />
            <div className="flex justify-center py-12">
              <Skeleton className="h-40 w-64 rounded-2xl shimmer" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 rounded-lg shimmer stagger-3" />
              <Skeleton className="h-48 rounded-lg shimmer stagger-4" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>
          <h2 className="font-display text-2xl mb-2">Verdict not available</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">{error}</p>
          <Link href="/lab" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
        </div>
      </main>
    );
  }

  const v = data;
  const style = v ? verdictStyle(v.verdict) : verdictStyle("REFINE");

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="animate-fade-in-up stagger-1 mb-6">
          <Link
            href={`/experiment/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" />
            Back to Experiment
          </Link>
        </div>

        {/* Verdict Hero */}
        <div className="animate-scale-in mb-10 flex flex-col items-center text-center">
          <div
            className={`mb-6 rounded-2xl border-2 px-10 py-8 ${style.bg} ${style.border} ${style.glow} transition-all`}
          >
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Verdict
            </p>
            <h1 className={`font-display text-6xl md:text-8xl ${style.text}`}>
              {v?.verdict}
            </h1>
            {v && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {v.confidence}% confidence
                </Badge>
              </div>
            )}
          </div>
          <h2 className="font-display text-2xl md:text-3xl mb-3">
            {v?.experiment_name}
          </h2>
          <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
            {v?.rationale || "The verdict is based on the experiment's hypothesis results and funnel performance."}
          </p>
        </div>

        {/* Hypothesis Results */}
        <div className="animate-fade-in-up stagger-3 mb-8">
          <h3 className="font-display text-xl mb-4 flex items-center gap-2">
            <Target className="size-5 text-gold" />
            Hypothesis Results
          </h3>
          {v?.hypotheses && v.hypotheses.length > 0 ? (
            <div className="space-y-3">
              {v.hypotheses.map((h, i) => (
                <Card
                  key={h.id}
                  className="border-border/50 bg-card/50 backdrop-blur-sm card-lift animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {h.passed ? (
                          <CheckCircle2 className="size-5 text-verdict-scale" />
                        ) : (
                          <XCircle className="size-5 text-verdict-kill" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{h.id}</Badge>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {h.category}
                          </Badge>
                          <Badge
                            className={`text-[10px] border ${
                              h.passed
                                ? "bg-verdict-scale/10 text-verdict-scale border-verdict-scale/30"
                                : "bg-verdict-kill/10 text-verdict-kill border-verdict-kill/30"
                            }`}
                          >
                            {h.passed ? "PASSED" : "FAILED"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{h.statement}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>
                            Actual: <span className="font-medium text-foreground">{(h.actual * 100).toFixed(1)}%</span>
                          </span>
                          <span>
                            Threshold: <span className="font-medium text-foreground">{(h.threshold * 100).toFixed(0)}%</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {h.actual >= h.threshold ? (
                              <TrendingUp className="size-3 text-verdict-scale" />
                            ) : (
                              <TrendingDown className="size-3 text-verdict-kill" />
                            )}
                            {((h.actual / h.threshold - 1) * 100).toFixed(0)}% vs threshold
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Hypothesis results will appear once the experiment collects sufficient data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="mb-8" />

        {/* Distribution ROI Table */}
        <div className="animate-fade-in-up stagger-5 mb-8">
          <h3 className="font-display text-xl mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-mineral" />
            Distribution ROI
          </h3>
          {v?.distribution_roi && v.distribution_roi.length > 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.distribution_roi.map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{row.channel}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="size-3 text-muted-foreground" />
                            {row.spend.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3 text-muted-foreground" />
                            {row.impressions.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <MousePointerClick className="size-3 text-muted-foreground" />
                            {row.clicks.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              row.ctr >= 2
                                ? "text-verdict-scale border-verdict-scale/30"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.ctr.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3 text-muted-foreground" />
                            {row.signups}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${row.cpa.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="mb-3 size-8 text-muted-foreground" />
                <h4 className="font-medium mb-1">No distribution data</h4>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Channel-level ROI will appear after distribution campaigns are synced.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recommendation */}
        {v?.recommendation && (
          <div className="animate-fade-in-up stagger-6">
            <Card className={`border-2 ${style.border} ${style.bg}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Award className={`size-6 shrink-0 ${style.text}`} />
                  <div>
                    <h4 className="font-display text-lg mb-2">Recommendation</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {v.recommendation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center animate-fade-in-up stagger-6">
          <Link href={`/experiment/${id}`} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ArrowLeft className="size-4" />
            Back to scorecard
          </Link>
          <Link href="/lab" className={cn(buttonVariants(), "gap-2 bg-accent text-accent-foreground hover:bg-accent/90")}>
            View all experiments
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
