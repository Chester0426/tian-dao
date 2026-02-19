"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Agent } from "@/lib/types";

type SortKey = "roi" | "win_rate" | "total_volume" | "total_trades";

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("roi");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("agents")
      .select("*")
      .order(sortBy, { ascending: false })
      .then(({ data }) => {
        if (data) setAgents(data);
        setLoading(false);
      });
  }, [sortBy]);

  function handleSort(key: SortKey) {
    setLoading(true);
    setSortBy(key);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">Top-performing agents ranked by performance</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/arena">Arena</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading agents...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("roi")}
                >
                  ROI % {sortBy === "roi" && "↓"}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("win_rate")}
                >
                  Win Rate {sortBy === "win_rate" && "↓"}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("total_volume")}
                >
                  Volume (SOL) {sortBy === "total_volume" && "↓"}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("total_trades")}
                >
                  Trades {sortBy === "total_trades" && "↓"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent, i) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/agent/${agent.id}`} className="font-semibold hover:underline">
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {agent.strategy_type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={agent.roi >= 0 ? "text-green-600" : "text-red-500"}
                  >
                    {agent.roi > 0 ? "+" : ""}{agent.roi}%
                  </TableCell>
                  <TableCell>{agent.win_rate}%</TableCell>
                  <TableCell>{agent.total_volume.toLocaleString()}</TableCell>
                  <TableCell>{agent.total_trades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
