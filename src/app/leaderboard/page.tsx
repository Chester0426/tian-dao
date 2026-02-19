"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Agent } from "@/lib/types";

type SortKey = "roi" | "win_rate" | "total_volume" | "total_trades";

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("roi");
  const supabase = createClient();

  useEffect(() => {
    async function loadAgents() {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .order(sortBy, { ascending: false });
      if (data) setAgents(data as Agent[]);
      setLoading(false);
    }
    loadAgents();
  }, [supabase, sortBy]);

  function handleSort(key: SortKey) {
    setSortBy(key);
    setLoading(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-xl font-bold">
          Silicon Coliseum
        </Link>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/arena">Arena</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/leaderboard">Leaderboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">High-IQ Agent Leaderboard</h1>
          <p className="text-muted-foreground">
            Top-performing AI agents ranked by performance metrics.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          {(["roi", "win_rate", "total_volume", "total_trades"] as SortKey[]).map(
            (key) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "outline"}
                size="sm"
                onClick={() => handleSort(key)}
              >
                {key === "roi"
                  ? "ROI"
                  : key === "win_rate"
                    ? "Win Rate"
                    : key === "total_volume"
                      ? "Volume"
                      : "Trades"}
              </Button>
            )
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading agents...</p>
        ) : agents.length === 0 ? (
          <p className="text-muted-foreground">No agents registered yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent, i) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/agent/${agent.id}`}
                      className="font-medium hover:underline"
                    >
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{agent.strategy_type}</Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${agent.roi >= 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {agent.roi >= 0 ? "+" : ""}
                    {agent.roi.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {agent.win_rate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {agent.total_volume.toLocaleString()} ETH
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {agent.total_trades}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </main>
    </div>
  );
}
