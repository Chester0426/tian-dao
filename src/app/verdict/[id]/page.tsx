"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trackVerdictDelivered } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VerdictData {
  id: string;
  experiment_id: string;
  experiment_name: string;
  verdict: "scale" | "refine" | "pivot" | "kill";
  confidence: number;
  rationale: string;
  hypotheses: {
    id: string;
    statement: string;
    status: "passing" | "failing";
    current_value: number;
    threshold: number;
  }[];
  distribution_roi: {
    channel: string;
    cost: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpa: number;
  }[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Verdict styling
// ---------------------------------------------------------------------------
const VERDICT_STYLES: Record<
  string,
  { color: string; bg: string; border: string; label: string; description: string }
> = {
  scale: {
    color: "text-verdict-scale",
    bg: "bg-verdict-scale/10",
    border: "border-verdict-scale/30",
    label: "SCALE",
    description: "All metrics exceed thresholds. This idea is validated. Build it.",
  },
  refine: {
    color: "text-verdict-refine",
    bg: "bg-verdict-refine/10",
    border: "border-verdict-refine/30",
    label: "REFINE",
    description: "Most metrics pass, but some need improvement. Iterate on weak areas.",
  },
  pivot: {
    color: "text-verdict-pivot",
    bg: "bg-verdict-pivot/10",
    border: "border-verdict-pivot/30",
    label: "PIVOT",
    description: "Multiple dimensions underperform. Change direction significantly.",
  },
  kill: {
    color: "text-verdict-kill",
    bg: "bg-verdict-kill/10",
    border: "border-verdict-kill/30",
    label: "KILL",
    description: "Top-funnel metrics fail. This idea lacks sufficient demand. Move on.",
  },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function VerdictSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-24 w-48 animate-skeleton rounded-xl bg-muted" />
        <div className="h-4 w-64 animate-skeleton rounded bg-muted" style={{ animationDelay: "0.1s" }} />
        <div className="h-4 w-40 animate-skeleton rounded bg-muted" style={{ animationDelay: "0.2s" }} />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="h-40 animate-skeleton rounded-lg bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function VerdictPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stampAnimated, setStampAnimated] = useState(false);

  useEffect(() => {
    async function fetchVerdict() {
      try {
        const res = await fetch(`/api/experiments/${params.id}/verdict`);
        if (res.ok) {
          const data = await res.json();
          setVerdict(data);
          trackVerdictDelivered({
            experiment_id: data.experiment_id,
            verdict: data.verdict,
            confidence: data.confidence,
          });
        }
      } catch (err) {
        console.error("Failed to load verdict:", err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchVerdict();
  }, [params.id]);

  // Trigger stamp animation after data loads
  useEffect(() => {
    if (verdict) {
      const timer = setTimeout(() => setStampAnimated(true), 300);
      return () => clearTimeout(timer);
    }
  }, [verdict]);

  const style = verdict ? VERDICT_STYLES[verdict.verdict] : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Experiment verdict
        </h1>
        <p className="mt-2 text-muted-foreground">
          Data-backed recommendation based on real funnel metrics and
          statistical confidence.
        </p>
      </div>

      {loading ? (
        <VerdictSkeleton />
      ) : !verdict ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gold/50" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display text-lg tracking-tight text-muted-foreground">
            Verdict not ready yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground/60">
            This experiment hasn&apos;t collected enough data for a verdict.
            Check back when the experiment has had more traffic.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => router.push(`/experiment/${params.id}`)}>
            View scorecard
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Verdict stamp */}
          <div className={`flex flex-col items-center py-8 ${style?.bg} rounded-2xl border ${style?.border} transition-all duration-500`}>
            <div
              className={`transform transition-all duration-500 ${
                stampAnimated
                  ? "scale-100 opacity-100"
                  : "scale-[0.8] opacity-0"
              }`}
            >
              <div className={`rounded-xl border-4 ${style?.border} px-10 py-6`}>
                <h2 className={`font-display text-5xl tracking-wider ${style?.color} md:text-6xl`}>
                  {style?.label}
                </h2>
              </div>
            </div>
            <p className={`mt-4 text-sm ${style?.color} transition-all duration-500 delay-200 ${
              stampAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}>
              {style?.description}
            </p>
            <Badge
              variant="outline"
              className={`mt-3 transition-all duration-500 delay-300 ${style?.border} ${style?.color} ${
                stampAnimated ? "opacity-100" : "opacity-0"
              }`}
            >
              {(verdict.confidence * 100).toFixed(0)}% confidence
            </Badge>
          </div>

          {/* Rationale */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Rationale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {verdict.rationale}
              </p>
            </CardContent>
          </Card>

          {/* Hypothesis Results */}
          <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Hypothesis results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {verdict.hypotheses.map((h) => (
                  <div key={h.id} className="flex items-center gap-4 rounded-lg border border-border/20 bg-background/30 p-4 transition-colors hover:border-border/40">
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">
                      {h.id}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{h.statement}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress
                          value={Math.min(
                            (h.current_value / h.threshold) * 100,
                            100
                          )}
                          className="h-1.5 flex-1"
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(h.current_value * 100).toFixed(1)}% / {(h.threshold * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${
                        h.status === "passing"
                          ? "border-verdict-scale/30 text-verdict-scale"
                          : "border-verdict-kill/30 text-verdict-kill"
                      }`}
                    >
                      {h.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Distribution ROI (b-11) */}
          {verdict.distribution_roi.length > 0 && (
            <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm stagger-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                  Distribution ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 pr-4">Channel</th>
                        <th className="pb-3 pr-4 text-right">Cost</th>
                        <th className="pb-3 pr-4 text-right">Impressions</th>
                        <th className="pb-3 pr-4 text-right">Clicks</th>
                        <th className="pb-3 pr-4 text-right">CTR</th>
                        <th className="pb-3 text-right">CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verdict.distribution_roi.map((row) => (
                        <tr
                          key={row.channel}
                          className="border-b border-border/10 transition-colors hover:bg-muted/30"
                        >
                          <td className="py-3 pr-4 font-medium capitalize">{row.channel}</td>
                          <td className="py-3 pr-4 text-right font-mono">${row.cost.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right font-mono">{row.impressions.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right font-mono">{row.clicks.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right font-mono">{(row.ctr * 100).toFixed(2)}%</td>
                          <td className="py-3 text-right font-mono">${row.cpa.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href={`/experiment/${verdict.experiment_id}`}>
              <Button variant="outline" className="border-border/50 hover:border-gold/30">
                View scorecard
              </Button>
            </Link>
            <Link href="/lab">
              <Button variant="outline" className="border-border/50 hover:border-gold/30">
                Back to lab
              </Button>
            </Link>
            <Link href="/assay">
              <Button className="bg-gold text-accent-foreground hover:bg-gold-bright">
                Test another idea
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
