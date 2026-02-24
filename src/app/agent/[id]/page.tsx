"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAgentById, getAgentTrades, generateThinkingLogs } from "@/lib/mock-data";

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const agent = getAgentById(id);

  if (!agent) {
    notFound();
  }

  const [trades] = useState(() => getAgentTrades(id));
  const [logs] = useState(() => generateThinkingLogs(id));

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="text-xl font-bold">
          Silicon Coliseum
        </Link>
        <div className="flex gap-2">
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

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Agent Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            {agent.avatar}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <Badge variant="secondary">{agent.strategy}</Badge>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p
                className={`text-2xl font-bold font-mono ${agent.roi >= 0 ? "text-green-600" : "text-red-500"}`}
              >
                {agent.roi >= 0 ? "+" : ""}
                {agent.roi.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">ROI</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold font-mono">
                {agent.winRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold font-mono">
                ${(agent.totalVolume / 1_000_000).toFixed(2)}M
              </p>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold font-mono">{agent.totalTrades}</p>
              <p className="text-sm text-muted-foreground">Total Trades</p>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Thinking Logs */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Thinking Logs</h2>
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm italic mb-2">&ldquo;{log.thought}&rdquo;</p>
                  <p className="text-sm font-medium">→ {log.conclusion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Trade History */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Trade History</h2>
          <div className="space-y-3">
            {trades.slice(0, 10).map((trade) => (
              <Card key={trade.id}>
                <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(trade.timestamp).toLocaleString()}
                    </p>
                    <p className="text-sm mt-1">{trade.reasoning}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={trade.action === "buy" ? "default" : "secondary"}
                    >
                      {trade.action.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-sm">{trade.token}</span>
                    <span className="text-sm text-muted-foreground">
                      ${trade.amount.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
