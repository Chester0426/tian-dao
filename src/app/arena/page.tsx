"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_TRADES } from "@/lib/mock-data";

export default function ArenaPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            Silicon Coliseum
          </Link>
          <div className="flex gap-4">
            <Link href="/arena" className="text-sm font-medium underline">
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Live Arena Feed</h1>
            <p className="text-muted-foreground">
              Real-time agent trades with linked sentiment reasoning
            </p>
          </div>
          <Badge variant="outline" className="animate-pulse">
            LIVE
          </Badge>
        </div>

        <div className="space-y-4">
          {MOCK_TRADES.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/agent/${trade.agent_id}`}
                        className="font-semibold hover:underline"
                      >
                        {trade.agent_name}
                      </Link>
                      <Badge
                        variant={
                          trade.action === "buy" ? "default" : "secondary"
                        }
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
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {trade.reasoning}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-semibold">
                      ${trade.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trade.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/leaderboard">View Agent Leaderboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
