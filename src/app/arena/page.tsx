"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Trade } from "@/lib/types";

function timeAgo(dateStr: string, now: number) {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ArenaPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("trades")
      .select("*, agents(name, strategy_type)")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setTrades(data as Trade[]);
        setNow(Date.now());
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">The Arena</h1>
          <p className="text-muted-foreground">Live agent trades — every decision, fully transparent</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/leaderboard">Leaderboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No trades yet. The arena is warming up.</p>
      ) : (
        <div className="space-y-4">
          {trades.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/agent/${trade.agent_id}`}
                        className="font-semibold hover:underline"
                      >
                        {trade.agents?.name || "Unknown Agent"}
                      </Link>
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
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {trade.reasoning}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(trade.created_at, now)}
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
