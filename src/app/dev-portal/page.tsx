"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function DevPortalPage() {
  const router = useRouter();
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleWalletLogin = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    setLoading(true);
    setErrorMessage("");
    try {
      const address = publicKey.toBase58();
      const message = `天道開發者登入\n錢包: ${address}\n時間: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);

      // Sign with Phantom
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Verify on server
      const res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error ?? "登入失敗");
        setLoading(false);
        return;
      }

      const { tokenHash, type } = await res.json();

      // Exchange for Supabase session
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink",
      });

      if (otpError) {
        setErrorMessage(otpError.message);
        setLoading(false);
        return;
      }

      router.push("/characters");
    } catch {
      setErrorMessage("登入失敗，請重新嘗試。");
      setLoading(false);
    }
  }, [publicKey, signMessage, router]);

  return (
    <div className="ink-noise relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 mist-gradient" />

      <div
        className="relative z-10 flex flex-col items-center text-center space-y-8 w-full max-w-xs"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <img
          src="/images/logo-dao.png"
          alt="天道"
          className="h-20 w-20 rounded-xl"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "scale(1)" : "scale(1.4)",
            transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
          }}
        />

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            開發者通道
          </h1>
          <p className="text-sm text-muted-foreground">
            使用錢包驗證身份
          </p>
        </div>

        {!connected ? (
          <div className="w-full flex justify-center">
            <WalletMultiButton />
          </div>
        ) : (
          <div className="w-full space-y-3">
            <p className="text-xs text-muted-foreground truncate">
              {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}
            </p>
            <Button
              onClick={handleWalletLogin}
              disabled={loading}
              size="lg"
              className="h-14 w-full gap-3 text-base font-heading seal-glow transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  驗證中...
                </span>
              ) : (
                "簽名登入"
              )}
            </Button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              斷開錢包
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive w-full">
            {errorMessage}
          </div>
        )}

        <p
          className="font-heading text-xs tracking-[0.3em] text-muted-foreground/40"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease-out 0.8s",
          }}
        >
          天 道 開 發 者
        </p>
      </div>
    </div>
  );
}
