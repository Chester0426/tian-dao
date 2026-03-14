"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid,
  Plus,
  Search,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  FlaskConical,
  ArrowRight,
  Beaker,
  Filter,
} from "lucide-react";
import Link from "next/link";

type ExperimentStatus = "draft" | "running" | "paused" | "completed";
type VerdictType = "SCALE" | "REFINE" | "PIVOT" | "KILL" | null;

type ExperimentCard = {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  verdict: VerdictType;
  created_at: string;
  days_running: number;
  visitors: number;
  signups: number;
  conversion_rate: number;
};

function statusBadge(status: ExperimentStatus) {
  const styles: Record<ExperimentStatus, string> = {
    running: "bg-verdict-scale/10 text-verdict-scale border-verdict-scale/30",
    paused: "bg-verdict-refine/10 text-verdict-refine border-verdict-refine/30",
    completed: "bg-mineral/10 text-mineral border-mineral/30",
    draft: "bg-muted text-muted-foreground border-border",
  };
  return styles[status];
}

function verdictBadgeClass(verdict: VerdictType) {
  if (!verdict) return "";
  const classes: Record<string, string> = {
    SCALE: "verdict-scale",
    REFINE: "verdict-refine",
    PIVOT: "verdict-pivot",
    KILL: "verdict-kill",
  };
  return classes[verdict] ?? "";
}

export default function LabPage() {
  const [experiments, setExperiments] = useState<ExperimentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus | "all">("all");
  const router = useRouter();

  useEffect(() => {
    async function fetchExperiments() {
      try {
        const res = await fetch("/api/experiments");
        if (!res.ok) throw new Error("Failed to load experiments");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.experiments ?? [];
        setExperiments(list);
        track("lab_viewed", { experiment_count: list.length });
      } catch {
        track("lab_viewed", { experiment_count: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchExperiments();
  }, []);

  const filtered = experiments.filter((e) => {
    const matchesSearch =
      !searchQuery ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusFilters: { value: ExperimentStatus | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "running", label: "Running" },
    { value: "completed", label: "Completed" },
    { value: "draft", label: "Draft" },
    { value: "paused", label: "Paused" },
  ];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
                <LayoutGrid className="size-5 text-accent" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl">Lab</h1>
            </div>
            <p className="text-muted-foreground">
              Your experiment portfolio. Track status, verdicts, and key metrics at a glance.
            </p>
          </div>
          <Link
            href="/assay"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2 active:scale-[0.98] transition-all shrink-0")}
          >
            <Plus className="size-4" />
            New experiment
          </Link>
        </div>

        {/* Search and filters */}
        <div className="animate-fade-in-up stagger-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-base bg-card/50 border-border/50"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Filter className="size-4 text-muted-foreground shrink-0" />
            {statusFilters.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
                className="shrink-0 text-xs"
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton
                key={i}
                className="h-48 rounded-lg shimmer"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="animate-fade-in-up flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-muted">
              <Beaker className="size-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-2xl mb-2">
              {experiments.length === 0 ? "No experiments yet" : "No results"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              {experiments.length === 0
                ? "Start by assaying your first idea. Describe it in a few sentences and our AI will generate a testable experiment."
                : "Try adjusting your search or filter criteria."}
            </p>
            {experiments.length === 0 && (
              <Link
                href="/assay"
                className={cn(buttonVariants(), "gap-2 bg-accent text-accent-foreground hover:bg-accent/90")}
              >
                <FlaskConical className="size-4" />
                Assay your first idea
              </Link>
            )}
          </div>
        )}

        {/* Experiment cards */}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((exp, i) => (
              <Card
                key={exp.id}
                className="group cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm card-lift animate-fade-in-up overflow-hidden"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => {
                  const dest = exp.verdict
                    ? `/verdict/${exp.id}`
                    : `/experiment/${exp.id}`;
                  router.push(dest);
                }}
              >
                {/* Verdict accent strip */}
                {exp.verdict && (
                  <div
                    className={`h-1 w-full ${
                      exp.verdict === "SCALE"
                        ? "bg-verdict-scale"
                        : exp.verdict === "REFINE"
                          ? "bg-verdict-refine"
                          : exp.verdict === "PIVOT"
                            ? "bg-verdict-pivot"
                            : "bg-verdict-kill"
                    }`}
                  />
                )}
                <CardContent className="p-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display text-lg leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                      {exp.name}
                    </h3>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <Badge className={`text-[10px] border ${statusBadge(exp.status)}`}>
                      {exp.status}
                    </Badge>
                    {exp.verdict && (
                      <Badge className={`text-[10px] border ${verdictBadgeClass(exp.verdict)}`}>
                        {exp.verdict}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {exp.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {exp.description}
                    </p>
                  )}

                  {/* Metrics strip */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/30 pt-3">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {exp.days_running}d
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="size-3" />
                      {exp.visitors.toLocaleString()} visits
                    </span>
                    {exp.conversion_rate > 0 && (
                      <span className="flex items-center gap-1 ml-auto">
                        {exp.conversion_rate >= 5 ? (
                          <TrendingUp className="size-3 text-verdict-scale" />
                        ) : (
                          <TrendingDown className="size-3 text-verdict-kill" />
                        )}
                        {exp.conversion_rate.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
