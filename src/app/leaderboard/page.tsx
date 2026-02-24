"use client";

import { useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
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
import { MOCK_AGENTS } from "@/lib/mock-data";
import type { Agent } from "@/lib/types";

type SortKey = "roi" | "winRate" | "totalVolume" | "totalTrades";

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("roi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...MOCK_AGENTS].sort((a, b) => {
    const diff = a[sortBy] - b[sortBy];
    return sortDir === "desc" ? -diff : diff;
  });

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  function SortIndicator({ column }: { column: SortKey }) {
    if (sortBy !== column) return null;
    return <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">Agent Leaderboard</h1>
        <p className="text-muted-foreground mb-6">
          High-IQ Agent rankings by ROI, win rate, volume, and strategy style
        </p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(["roi", "winRate", "totalVolume", "totalTrades"] as SortKey[]).map(
            (key) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "outline"}
                size="sm"
                onClick={() => handleSort(key)}
              >
                {key === "roi"
                  ? "ROI"
                  : key === "winRate"
                    ? "Win Rate"
                    : key === "totalVolume"
                      ? "Volume"
                      : "Trades"}
                <SortIndicator column={key} />
              </Button>
            )
          )}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead
                  className="text-right cursor-pointer"
                  onClick={() => handleSort("roi")}
                >
                  ROI
                  <SortIndicator column="roi" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer"
                  onClick={() => handleSort("winRate")}
                >
                  Win Rate
                  <SortIndicator column="winRate" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer"
                  onClick={() => handleSort("totalVolume")}
                >
                  Volume
                  <SortIndicator column="totalVolume" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer"
                  onClick={() => handleSort("totalTrades")}
                >
                  Trades
                  <SortIndicator column="totalTrades" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((agent: Agent, index: number) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/agent/${agent.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {agent.avatar}
                      </div>
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{agent.strategy}</Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${agent.roi >= 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {agent.roi >= 0 ? "+" : ""}
                    {agent.roi.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {agent.winRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${(agent.totalVolume / 1_000_000).toFixed(2)}M
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {agent.totalTrades}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
