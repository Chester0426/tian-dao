"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { trackActivate, trackPayStart, trackCheckoutStarted } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BillingInfo {
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due" | null;
  current_period_end: string | null;
  usage: {
    experiments_used: number;
    experiments_limit: number;
  };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="h-5 w-32 animate-skeleton rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-full animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
            <div className="h-4 w-2/3 animate-skeleton rounded bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    trackActivate({ action: "settings_viewed" });

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        if (session?.user) {
          const res = await fetch("/api/billing/status");
          if (res.ok) {
            setBilling(await res.json());
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      trackPayStart({ plan: "pro", amount_cents: 2900 });
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      if (res.ok) {
        const data = await res.json();
        trackCheckoutStarted({ plan: "pro", amount_cents: 2900 });
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageBilling() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Portal redirect failed:", err);
    }
  }

  if (!loading && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gold/50" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="font-display text-xl tracking-tight">
          Sign in to view settings
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in to manage your account.
        </p>
        <Button
          className="mt-6 bg-gold text-accent-foreground hover:bg-gold-bright"
          onClick={() => router.push("/login")}
        >
          Log in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account, connected services, and billing.
        </p>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    <path d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    value={user?.email ?? ""}
                    disabled
                    className="text-base bg-background/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    User ID
                  </Label>
                  <Input
                    value={user?.id ?? ""}
                    disabled
                    className="font-mono text-sm bg-background/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Auth provider
                  </Label>
                  <div className="flex gap-2">
                    {user?.app_metadata?.provider && (
                      <Badge variant="secondary" className="capitalize">
                        {user.app_metadata.provider}
                      </Badge>
                    )}
                    {!user?.app_metadata?.provider && (
                      <Badge variant="secondary">Email</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Member since
                  </Label>
                  <p className="text-sm text-foreground">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-6">
            <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                  </svg>
                  Connected channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Google Ads", icon: "G", connected: false },
                    { name: "Meta Ads", icon: "M", connected: false },
                    { name: "Reddit Ads", icon: "R", connected: false },
                  ].map((channel) => (
                    <div
                      key={channel.name}
                      className="flex items-center justify-between rounded-lg border border-border/30 bg-background/30 p-4 transition-colors hover:border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-display text-lg">
                          {channel.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{channel.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {channel.connected
                              ? "Connected"
                              : "Not connected"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border/50 hover:border-gold/30"
                      >
                        {channel.connected ? "Disconnect" : "Connect"}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Connect ad platform accounts to enable automated distribution
                  campaigns for your experiments.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="animate-fade-in-up border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-gold">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Current plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl capitalize">
                        {billing?.plan ?? "free"}
                      </h3>
                      {billing?.status === "active" && (
                        <Badge
                          variant="outline"
                          className="border-verdict-scale/30 text-verdict-scale text-xs"
                        >
                          Active
                        </Badge>
                      )}
                      {billing?.status === "canceled" && (
                        <Badge
                          variant="outline"
                          className="border-verdict-pivot/30 text-verdict-pivot text-xs"
                        >
                          Canceled
                        </Badge>
                      )}
                    </div>
                    {billing?.current_period_end && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {billing.status === "canceled" ? "Access until" : "Renews"}{" "}
                        {new Date(billing.current_period_end).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {billing?.plan === "free" ? (
                    <Button
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="bg-gold text-accent-foreground hover:bg-gold-bright"
                    >
                      {upgrading ? "Redirecting..." : "Upgrade to Pro — $29/mo"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleManageBilling}
                      className="border-border/50 hover:border-gold/30"
                    >
                      Manage billing
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Usage */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Usage
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Experiments</p>
                    <p className="font-mono text-sm">
                      {billing?.usage.experiments_used ?? 0} /{" "}
                      {billing?.usage.experiments_limit === -1
                        ? "unlimited"
                        : billing?.usage.experiments_limit ?? 3}
                    </p>
                  </div>
                </div>

                {/* Plan comparison */}
                {billing?.plan === "free" && (
                  <>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/30 bg-background/30 p-4">
                        <h4 className="font-display text-sm">Free</h4>
                        <p className="mt-1 font-display text-2xl">$0</p>
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            3 experiments
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            AI spec generation
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-muted-foreground/40"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Automated distribution
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-muted-foreground/40"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Real-time alerts
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm text-gold">Pro</h4>
                          <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">
                            Recommended
                          </Badge>
                        </div>
                        <p className="mt-1 font-display text-2xl">$29<span className="text-sm text-muted-foreground">/mo</span></p>
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            Unlimited experiments
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            AI spec generation
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            Automated distribution
                          </li>
                          <li className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-verdict-scale"><polyline points="20 6 9 17 4 12" /></svg>
                            Real-time alerts
                          </li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
