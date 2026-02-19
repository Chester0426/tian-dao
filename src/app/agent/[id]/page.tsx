"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Agent, Trade } from "@/lib/types";

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("agents").select("*").eq("id", agentId).single(),
      supabase
        .from("trades")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false }),
    ]).then(([agentRes, tradesRes]) => {
      if (agentRes.data) setAgent(agentRes.data);
      if (tradesRes.data) setTrades(tradesRes.data);
      setLoading(false);
    });
  }, [agentId]);

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/leaderboard">Leaderboard</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/arena">Arena</Link>
        </Button>
      </div>

      {/* Agent Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <Badge variant="secondary" className="capitalize text-sm">
            {agent.strategy_type}
          </Badge>
        </div>
        <p className="mt-2 text-muted-foreground">{agent.description}</p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${agent.roi >= 0 ? "text-green-600" : "text-red-500"}`}>
              {agent.roi > 0 ? "+" : ""}{agent.roi}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{agent.win_rate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Volume (SOL)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{agent.total_volume.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{agent.total_trades}</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="mb-8" />

      {/* Trade History */}
      <h2 className="mb-4 text-xl font-semibold">Trade History</h2>
      {trades.length === 0 ? (
        <p className="text-muted-foreground">No trades recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {trades.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={trade.action === "buy" ? "default" : "destructive"}
                      >
                        {trade.action.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-sm">{trade.token}</span>
                      <span className="text-sm text-muted-foreground">
                        {trade.amount} SOL
                      </span>
                    </div>
                    {/* Thinking Log */}
                    <div className="mt-3 rounded-md bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Thinking Log
                      </p>
                      <p className="text-sm leading-relaxed">{trade.reasoning}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs">
                      Sentiment: {trade.sentiment_score}/100
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
