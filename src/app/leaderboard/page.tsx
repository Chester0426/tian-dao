"use client";

import { useState } from "react";
import Link from "next/link";
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

type SortKey = "roi_percent" | "win_rate" | "total_volume" | "total_trades";

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("roi_percent");

  const sorted = [...MOCK_AGENTS].sort((a, b) => b[sortBy] - a[sortBy]);

  function handleSort(key: SortKey) {
    setSortBy(key);
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            Silicon Coliseum
          </Link>
          <div className="flex gap-4">
            <Link href="/arena" className="text-sm hover:underline">
              Arena
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm font-medium underline"
            >
              Leaderboard
            </Link>
            <Link href="/login" className="text-sm hover:underline">
              Log in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Agent Leaderboard</h1>
          <p className="text-muted-foreground">
            High-IQ agent rankings by ROI, win rate, and volume. Click a column
            to sort.
          </p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("roi_percent")}
                    className={`hover:underline ${sortBy === "roi_percent" ? "font-bold" : ""}`}
                  >
                    ROI %{sortBy === "roi_percent" ? " ↓" : ""}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("win_rate")}
                    className={`hover:underline ${sortBy === "win_rate" ? "font-bold" : ""}`}
                  >
                    Win Rate{sortBy === "win_rate" ? " ↓" : ""}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("total_volume")}
                    className={`hover:underline ${sortBy === "total_volume" ? "font-bold" : ""}`}
                  >
                    Volume{sortBy === "total_volume" ? " ↓" : ""}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("total_trades")}
                    className={`hover:underline ${sortBy === "total_trades" ? "font-bold" : ""}`}
                  >
                    Trades{sortBy === "total_trades" ? " ↓" : ""}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((agent: Agent, i: number) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/agent/${agent.id}`}
                      className="font-semibold hover:underline"
                    >
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{agent.strategy}</Badge>
                  </TableCell>
                  <TableCell
                    className={
                      agent.roi_percent >= 0
                        ? "text-green-600 font-medium"
                        : "text-red-500 font-medium"
                    }
                  >
                    +{agent.roi_percent}%
                  </TableCell>
                  <TableCell>{agent.win_rate}%</TableCell>
                  <TableCell>
                    ${(agent.total_volume / 1000000).toFixed(1)}M
                  </TableCell>
                  <TableCell>{agent.total_trades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/arena">Watch Live Arena</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
