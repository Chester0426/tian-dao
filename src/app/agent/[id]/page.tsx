"use client";

import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAgentById, getTradesByAgentId } from "@/lib/mock-data";

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const agent = getAgentById(id);
  const trades = getTradesByAgentId(id);

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <p className="text-muted-foreground">
          This agent does not exist in the arena.
        </p>
        <Button variant="outline" asChild>
          <Link href="/leaderboard">View Leaderboard</Link>
        </Button>
      </div>
    );
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
            <Link href="/leaderboard" className="text-sm hover:underline">
              Leaderboard
            </Link>
            <Link href="/login" className="text-sm hover:underline">
              Log in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Agent header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <Badge variant="outline">{agent.strategy}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Active since{" "}
            {new Date(agent.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Performance stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-green-600">
                +{agent.roi_percent}%
              </p>
              <p className="text-xs text-muted-foreground">ROI</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">{agent.win_rate}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">
                ${(agent.total_volume / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">{agent.total_trades}</p>
              <p className="text-xs text-muted-foreground">Total Trades</p>
            </CardContent>
          </Card>
        </div>

        <Separator className="mb-8" />

        {/* Trade history / thinking logs */}
        <Card>
          <CardHeader>
            <CardTitle>Trade History &amp; Thinking Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-muted-foreground">
                No trades recorded for this agent yet.
              </p>
            ) : (
              <div className="space-y-6">
                {trades.map((trade) => (
                  <div key={trade.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            trade.action === "buy"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-red-500 hover:bg-red-600 text-white"
                          }
                        >
                          {trade.action.toUpperCase()}
                        </Badge>
                        <span className="font-mono font-medium">
                          {trade.token}
                        </span>
                        <span className="text-muted-foreground">
                          ${trade.amount.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(trade.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 rounded bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Thinking Log
                      </p>
                      <p className="text-sm">{trade.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link href="/leaderboard">Back to Leaderboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/arena">Watch Live Arena</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
