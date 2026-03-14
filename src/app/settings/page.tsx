"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { trackActivate, trackPayStart } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  User,
  CreditCard,
  Link2,
  Shield,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Crown,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Subscription = {
  plan: string;
  status: string;
  current_period_end: string | null;
  amount_cents: number;
};

type OAuthConnection = {
  provider: string;
  connected: boolean;
  email?: string;
};

export default function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const router = useRouter();

  useEffect(() => {
    trackActivate({ action: "settings_viewed" });

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: SupabaseUser; identities?: { provider: string; identity_data?: Record<string, unknown> }[] } | null } }) => {
      if (!session?.user) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setLoading(false);

      // Derive OAuth connections from user identities
      const identities = session.identities ?? session.user.identities ?? [];
      type Identity = { provider: string; identity_data?: Record<string, unknown> };
      const providers: OAuthConnection[] = [
        {
          provider: "google",
          connected: identities.some((id: Identity) => id.provider === "google"),
          email: identities.find((id: Identity) => id.provider === "google")?.identity_data?.email as string | undefined,
        },
        {
          provider: "github",
          connected: identities.some((id: Identity) => id.provider === "github"),
          email: identities.find((id: Identity) => id.provider === "github")?.identity_data?.email as string | undefined,
        },
      ];
      setConnections(providers);
    });

    // Fetch subscription
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSubscription(data);
      })
      .finally(() => setSubLoading(false));
  }, [router]);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      trackPayStart({ plan: "pro", amount_cents: 2900 });
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      if (!res.ok) throw new Error("Failed to create checkout");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      // Handle error silently
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to open portal");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      // Handle error silently
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleConnectOAuth(provider: "google" | "github") {
    const supabase = createClient();
    await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/settings` },
    });
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
          <Skeleton className="h-10 w-48 shimmer mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-48 shimmer" />
            <Skeleton className="h-48 shimmer stagger-2" />
            <Skeleton className="h-48 shimmer stagger-3" />
          </div>
        </div>
      </main>
    );
  }

  const isPro = subscription?.plan === "pro" && subscription?.status === "active";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-crucible">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="animate-fade-in-up stagger-1 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
              <SettingsIcon className="size-5 text-accent" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your account, connections, and billing.
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <Card className="animate-fade-in-up stagger-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-gold" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="mt-1 text-base bg-background/50"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <Input
                  value={user?.id ? user.id.slice(0, 16) + "..." : ""}
                  disabled
                  className="mt-1 text-base bg-background/50 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Member since</Label>
                <p className="mt-1 text-sm">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "--"}
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive emails for verdicts and experiment milestones
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* OAuth Connections */}
          <Card className="animate-fade-in-up stagger-3 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4 text-mineral" />
                Connected Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.provider}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Shield className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{conn.provider}</p>
                      {conn.connected && conn.email && (
                        <p className="text-xs text-muted-foreground">{conn.email}</p>
                      )}
                    </div>
                  </div>
                  {conn.connected ? (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs text-verdict-scale border-verdict-scale/30"
                    >
                      <CheckCircle2 className="size-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleConnectOAuth(conn.provider as "google" | "github")
                      }
                      className="gap-1.5 text-xs"
                    >
                      Connect
                      <ArrowRight className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Billing Section */}
          <Card className="animate-fade-in-up stagger-4 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-copper" />
                Billing & Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 shimmer" />
                  <Skeleton className="h-8 w-32 shimmer" />
                </div>
              ) : isPro ? (
                <div className="space-y-4">
                  {/* Active plan */}
                  <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
                        <Crown className="size-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          Pro Plan
                          <Badge className="text-[10px] bg-accent/10 text-accent border-accent/30">
                            Active
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${((subscription?.amount_cents ?? 0) / 100).toFixed(2)}/month
                        </p>
                      </div>
                    </div>
                    {subscription?.current_period_end && (
                      <p className="text-xs text-muted-foreground">
                        Renews{" "}
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="gap-2"
                  >
                    {portalLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        Manage billing
                        <ExternalLink className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Free plan */}
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
                    <div>
                      <p className="text-sm font-medium">Free Plan</p>
                      <p className="text-xs text-muted-foreground">
                        1 active experiment, limited features
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">Current</Badge>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <Sparkles className="size-5 text-accent shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-display text-lg">Upgrade to Pro</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Unlock unlimited experiments, advanced analytics, and priority support.
                        </p>
                      </div>
                    </div>
                    <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-accent shrink-0" />
                        Unlimited active experiments
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-accent shrink-0" />
                        Advanced distribution controls
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-accent shrink-0" />
                        Priority verdict processing
                      </li>
                    </ul>
                    <Button
                      onClick={handleUpgrade}
                      disabled={upgradeLoading}
                      className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 glow-gold active:scale-[0.98] transition-all"
                    >
                      {upgradeLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Opening checkout...
                        </>
                      ) : (
                        <>
                          <Crown className="size-4" />
                          Upgrade for $29/month
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="animate-fade-in-up stagger-5 border-destructive/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertCircle className="size-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" size="sm" disabled>
                Delete account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
