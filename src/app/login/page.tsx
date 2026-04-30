"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle } from "@/components/language-toggle";
import { QiParticles } from "@/components/qi-particles";

export default function LoginPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { publicKey, signMessage, connect: walletConnect, connected: walletConnected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch {
      setErrorMessage("Google 登入失敗，請重新嘗試。");
      setLoading(false);
    }
  };

  const handlePhantomAuth = async () => {
    setErrorMessage("");
    if (!walletConnected || !publicKey || !signMessage) {
      try {
        if (!walletConnected) await walletConnect();
      } catch {
        setWalletModalVisible(true);
        return;
      }
      if (!publicKey || !signMessage) {
        setWalletModalVisible(true);
        return;
      }
    }
    setLoading(true);
    try {
      const address = publicKey.toBase58();
      const message = `天道 Tian Dao 簽名\n錢包: ${address}\n時間: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Try login first; if wallet not bound, signup
      let res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });

      if (res.status === 403) {
        res = await fetch("/api/auth/wallet-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, signature, message }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error ?? (locale === "zh" ? "錢包驗證失敗" : "Wallet verification failed"));
        setLoading(false);
        return;
      }

      const { tokenHash, type } = await res.json();
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
      setErrorMessage(locale === "zh" ? "錢包簽章失敗，請重新嘗試" : "Wallet signature failed, please retry");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("請輸入 Email 和密碼。");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      router.push("/characters");
    } catch {
      setErrorMessage("發生意外錯誤，請重新嘗試。");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Background image with dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/cfdb37ef-6450-4434-844a-d087c65ff5bb.jpeg')",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1.5s ease-out",
        }}
      />
      {/* Dark overlay to blend with dark theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      {/* Extra vignette on edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]" />
      <QiParticles />

      {/* Language toggle — top right */}
      <LanguageToggle />

      {/* Developer login — bottom right */}
      <Link
        href="/dev-portal"
        className="absolute bottom-4 right-5 z-20 text-xs text-white/30 hover:text-white/60 transition-colors"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.8s ease-out 1s, color 0.2s",
        }}
      >
        {locale === "zh" ? "開發者" : "Developer"}
      </Link>

      {/* Main content — centered */}
      <div className="relative z-10 flex w-full items-center justify-center px-6 py-6">
        <div
          className="w-full max-w-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
          }}
        >
          {/* Logo + Title */}
          <div className="mb-6 text-center">
            <Link href="/">
              <img
                src="/images/logo-dao.png"
                alt="天道"
                className="mx-auto mb-4 h-16 w-16 rounded-xl cursor-pointer transition-transform hover:scale-105 drop-shadow-[0_0_20px_rgba(200,160,100,0.3)]"
              />
            </Link>

            <h1 className="font-heading text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              {t("login_welcome")}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {t("login_subtitle")}
            </p>

            <div
              className="mx-auto mt-4 h-px w-16"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.6), transparent)",
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scaleX(1)" : "scaleX(0)",
                transition: "opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s",
              }}
            />
          </div>

          {/* Login card */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: '420px',
              maxWidth: '100%',
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s ease-out 0.35s, transform 0.6s ease-out 0.35s",
            }}
          >
            <img
              src="/images/card-bg5.png"
              alt=""
              className="w-full h-auto block"
            />
            <div
              className="absolute top-0 bottom-0 left-[10%] p-5 flex flex-col items-center justify-end"
              style={{ width: "80%", paddingBottom: 'calc(1.25rem + 50px)' }}
            >
            {/* Google login */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mb-4 h-11 w-full gap-3 text-sm font-medium border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {t("login_google")}
            </Button>

            {/* Phantom wallet login (auto-signup if first time) */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePhantomAuth}
              disabled={loading}
              className="mb-4 h-11 w-full gap-3 text-sm font-medium border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4286 64.0583C13.9696 87.5806 35.6517 108 59.4288 108H62.4282C83.3849 108 111.4 91.6816 115.78 71.7585C116.585 68.0976 113.733 64.9142 110.584 64.9142ZM39.7689 65.9454C39.7689 69.0476 37.219 71.5836 34.1014 71.5836C30.9837 71.5836 28.4338 69.0405 28.4338 65.9454V56.8615C28.4338 53.7593 30.9837 51.2233 34.1014 51.2233C37.219 51.2233 39.7689 53.7664 39.7689 56.8615V65.9454ZM59.4571 65.9454C59.4571 69.0476 56.9072 71.5836 53.7895 71.5836C50.6719 71.5836 48.1219 69.0405 48.1219 65.9454V56.8615C48.1219 53.7593 50.679 51.2233 53.7895 51.2233C56.9 51.2233 59.4571 53.7664 59.4571 56.8615V65.9454Z" fill="#AB9FF2"/>
              </svg>
              {locale === "zh" ? "用 Phantom 錢包登入" : "Sign in with Phantom"}
            </Button>

            <div className="relative mb-4 w-full">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 px-3 text-xs text-white/40">
                {t("or")}
              </span>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email" className="text-xs font-medium uppercase tracking-wider text-white/50">
                  {t("login_email")}
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                  className="h-10 text-[16px] border-white/15 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-spirit-gold/50 focus-visible:shadow-[0_0_12px_rgba(200,160,100,0.15)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password" className="text-xs font-medium uppercase tracking-wider text-white/50">
                  {t("login_password")}
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder={locale === "zh" ? "輸入密碼" : "Enter password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-10 text-[16px] border-white/15 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-spirit-gold/50 focus-visible:shadow-[0_0_12px_rgba(200,160,100,0.15)]"
                />
              </div>

              {errorMessage && (
                <div
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 relative w-full hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <img src="/images/btn-bg7.png" alt="" className="w-full h-auto block" />
                <span className="absolute inset-0 flex items-center justify-end pr-10 font-heading font-bold text-base text-white">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t("login_logging")}
                    </span>
                  ) : (
                    t("login_submit")
                  )}
                </span>
              </button>
            </form>

            <Separator className="my-4 bg-white/10 w-full" />

            <p className="text-center text-sm text-white/50 w-full">
              {t("login_noAccount")}{" "}
              <Link
                href="/signup"
                className="font-medium text-spirit-gold/80 underline-offset-4 transition-all hover:text-spirit-gold hover:underline"
              >
                {t("login_signup")}
              </Link>
            </p>
            </div>
          </div>

          {/* Bottom text */}
          <p
            className="mt-5 text-center font-heading text-xs tracking-[0.3em] text-white/25"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 0.8s ease-out 0.8s",
            }}
          >
            {locale === "zh" ? "修 仙 之 路" : "P A T H · O F · T A O"}
          </p>
        </div>
      </div>
    </div>
  );
}
