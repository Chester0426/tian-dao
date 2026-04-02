"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleRegisterPasskey = async () => {
    setStatus("loading");
    setMessage("");
    try {
      // 1. Get registration options
      const optionsRes = await fetch("/api/auth/webauthn/register-options", { method: "POST" });
      if (!optionsRes.ok) {
        const errBody = await optionsRes.json().catch(() => ({}));
        setStatus("error");
        setMessage(`無法取得註冊選項 (${optionsRes.status}: ${errBody.error ?? "unknown"})`);
        return;
      }
      const options = await optionsRes.json();

      // 2. Trigger Touch ID registration
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) {
        setStatus("error");
        setMessage("註冊失敗");
        return;
      }

      setStatus("success");
      setMessage("Passkey 已註冊！下次可以用指紋登入。");
    } catch (err) {
      setStatus("error");
      setMessage(`註冊過程中斷或失敗: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-xl">設定 Passkey (Touch ID)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            註冊你的指紋後，下次就可以用 Touch ID 登入，不需要輸入密碼或使用 Google。
          </p>
          <Button
            onClick={handleRegisterPasskey}
            disabled={status === "loading"}
            className="w-full seal-glow font-heading"
          >
            {status === "loading" ? "註冊中..." : "註冊指紋 (Touch ID)"}
          </Button>
          {message && (
            <p className={`text-sm ${status === "success" ? "text-jade" : "text-destructive"}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
