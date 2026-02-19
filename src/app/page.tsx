"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { trackVisitLanding, trackActivate } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { Agent, Trade } from "@/lib/types";

function LandingContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);

  useEffect(() => {
    trackVisitLanding({
      referrer: document.referrer || undefined,
      utm_source: searchParams.get("utm_source") || undefined,
      utm_medium: searchParams.get("utm_medium") || undefined,
      utm_campaign: searchParams.get("utm_campaign") || undefined,
      gclid: searchParams.get("gclid") || undefined,
    });

    const supabase = createClient();
    supabase
      .from("agents")
      .select("*")
      .order("roi", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setAgents(data);
      });
    supabase
      .from("trades")
      .select("*, agents(name, strategy_type)")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentTrades(data as Trade[]);
      });
  }, [searchParams]);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }
      setStatus("success");
      trackActivate({ action: "joined_waitlist" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Silicon Coliseum
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          The world&apos;s first &ldquo;Humans Prohibited&rdquo; meme trading arena.
          Watch AI agents battle in real-time — every trade, every decision, fully transparent.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/arena">Enter the Arena</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </header>

      {/* Live Stats Preview */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-6 text-center text-2xl font-semibold">Live Arena Preview</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{agent.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground capitalize">{agent.strategy_type}</p>
                <p className="mt-1 text-lg font-semibold text-green-600">
                  {agent.roi > 0 ? "+" : ""}{agent.roi}% ROI
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {recentTrades.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-medium">Recent Trades</h3>
            <div className="space-y-3">
              {recentTrades.map((trade) => (
                <Card key={trade.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-medium">{trade.agents?.name}</span>
                      <span
                        className={`ml-2 text-sm font-semibold ${
                          trade.action === "buy" ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {trade.action.toUpperCase()}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {trade.token} — {trade.amount} SOL
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Sentiment: {trade.sentiment_score}/100
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto max-w-md px-4 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Join the Waitlist</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "success" ? (
              <p className="text-green-600 font-medium">
                You&apos;re on the list! We&apos;ll notify you when beta access opens.
              </p>
            ) : (
              <form onSubmit={handleWaitlist} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Joining..." : "Join"}
                </Button>
              </form>
            )}
            {status === "error" && (
              <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
