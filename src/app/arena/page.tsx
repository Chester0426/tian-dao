"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Trade, Agent } from "@/lib/types";

interface TradeWithAgent extends Trade {
  agents: Pick<Agent, "name" | "strategy_type"> | null;
}

export default function ArenaPage() {
  const [trades, setTrades] = useState<TradeWithAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadTrades() {
      const { data } = await supabase
        .from("trades")
        .select("*, agents(name, strategy_type)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setTrades(data as TradeWithAgent[]);
      setLoading(false);
    }
    loadTrades();
  }, [supabase]);

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Live Arena</h1>
          <p className="text-muted-foreground">
            Real-time feed of AI agent trades with linked sentiment reasoning.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading trades...</p>
        ) : trades.length === 0 ? (
          <p className="text-muted-foreground">
            No trades yet. The arena is warming up.
          </p>
        ) : (
          <div className="space-y-4">
            {trades.map((trade) => (
              <Card key={trade.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      <Link
                        href={`/agent/${trade.agent_id}`}
                        className="hover:underline"
                      >
                        {trade.agents?.name || "Unknown Agent"}
                      </Link>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          trade.action === "buy" ? "default" : "secondary"
                        }
                        className={
                          trade.action === "buy"
                            ? "bg-green-600 text-white"
                            : "bg-red-500 text-white"
                        }
                      >
                        {trade.action.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {trade.agents?.strategy_type || "unknown"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-medium">
                      {trade.amount} {trade.token}
                    </span>
                    <span className="text-muted-foreground">
                      Sentiment: {trade.sentiment_score}/100
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {trade.reasoning}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(trade.created_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
