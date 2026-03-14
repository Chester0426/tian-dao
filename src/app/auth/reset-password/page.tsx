"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/assay"), 2000);
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12 bg-crucible">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/10">
            <Lock className="size-7 text-accent" />
          </div>
          <h1 className="font-display text-3xl">Set new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>

        <Card className="animate-fade-in-up stagger-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            {success ? (
              <div className="py-4 text-center animate-scale-in">
                <CheckCircle2 className="mx-auto mb-3 size-10 text-verdict-scale" />
                <p className="font-medium text-verdict-scale">
                  Password updated successfully!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Redirecting you to the app...
                </p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <div>
                  <Label htmlFor="password" className="text-sm">
                    New Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1 text-base"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Set new password"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
