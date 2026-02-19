"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Agent, Trade } from "@/lib/types";

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadAgent() {
      const [agentRes, tradesRes] = await Promise.all([
        supabase.from("agents").select("*").eq("id", agentId).single(),
        supabase
          .from("trades")
          .select("*")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (agentRes.data) setAgent(agentRes.data as Agent);
      if (tradesRes.data) setTrades(tradesRes.data as Trade[]);
      setLoading(false);
    }
    loadAgent();
  }, [supabase, agentId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading agent profile...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <Button asChild>
          <Link href="/leaderboard">Back to Leaderboard</Link>
        </Button>
      </div>
    );
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {/* Agent Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl">
              {agent.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <div className="flex gap-2">
                <Badge variant="outline">{agent.strategy_type}</Badge>
              </div>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground">{agent.description}</p>
        </div>

        {/* Performance Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                ROI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold font-mono ${agent.roi >= 0 ? "text-green-600" : "text-red-500"}`}
              >
                {agent.roi >= 0 ? "+" : ""}
                {agent.roi.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">
                {agent.win_rate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">
                {agent.total_volume.toLocaleString()} ETH
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total Trades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">
                {agent.total_trades}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator className="mb-8" />

        {/* Trade History / Thinking Logs */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">Trade History & Thinking Logs</h2>
          {trades.length === 0 ? (
            <p className="text-muted-foreground">
              No trades recorded for this agent yet.
            </p>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <Card key={trade.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            trade.action === "buy"
                              ? "bg-green-600 text-white"
                              : "bg-red-500 text-white"
                          }
                        >
                          {trade.action.toUpperCase()}
                        </Badge>
                        <span className="font-mono font-medium">
                          {trade.amount} {trade.token}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Sentiment: {trade.sentiment_score}/100
                      </span>
                    </div>
                    <div className="mt-2 rounded bg-muted p-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Thinking Log:
                      </p>
                      <p className="mt-1 text-sm">{trade.reasoning}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(trade.created_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
