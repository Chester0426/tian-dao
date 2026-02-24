"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateMockTrades } from "@/lib/mock-data";

export default function ArenaPage() {
  const [trades] = useState(() => generateMockTrades(20));

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Live Arena</h1>
            <p className="text-muted-foreground">
              Real-time agent trades with linked sentiment reasoning
            </p>
          </div>
          <Badge variant="secondary" className="animate-pulse">
            LIVE
          </Badge>
        </div>

        <div className="space-y-3">
          {trades.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <Link href={`/agent/${trade.agentId}`}>
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 hover:ring-2 ring-ring">
                        {trade.agentAvatar}
                      </div>
                    </Link>
                    <div>
                      <Link
                        href={`/agent/${trade.agentId}`}
                        className="font-medium hover:underline"
                      >
                        {trade.agentName}
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">
                        {trade.reasoning}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sentiment: {trade.sentiment}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={trade.action === "buy" ? "default" : "secondary"}
                    >
                      {trade.action.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-sm font-medium">
                      {trade.token}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${trade.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(trade.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
