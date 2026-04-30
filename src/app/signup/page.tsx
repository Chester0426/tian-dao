"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { trackSignupStart, trackSignupComplete } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle } from "@/components/language-toggle";
import { QiParticles } from "@/components/qi-particles";

type FormState = "idle" | "submitting" | "success" | "error";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  const { publicKey, signMessage, connect: walletConnect, connected: walletConnected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const { locale, t } = useI18n();

  useEffect(() => {
    setMounted(true);
    trackSignupStart({ method: "email" });
  }, []);

  const handleGoogleSignup = async () => {
    setFormState("submitting");
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
        setFormState("error");
      }
    } catch {
      setErrorMessage("Google 註冊失敗，請重新嘗試。");
      setFormState("error");
    }
  };

  const handlePhantomAuth = async () => {
    setErrorMessage("");
    // Step 1: ensure wallet connected
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
    setFormState("submitting");
    try {
      // Step 2: fetch one-time nonce from server (anti-phishing)
      const nonceRes = await fetch("/api/auth/wallet-nonce");
      if (!nonceRes.ok) throw new Error("nonce fetch failed");
      const { nonce } = await nonceRes.json();

      // Step 3: build SIWE-style message including domain + nonce
      const address = publicKey.toBase58();
      const domain = typeof window !== "undefined" ? window.location.host : "tiantao.vercel.app";
      const issuedAt = new Date().toISOString();
      const message =
        `${domain} 邀請你登入天道 Tian Dao\n\n` +
        `Wallet: ${address}\n` +
        `Nonce: ${nonce}\n` +
        `Issued At: ${issuedAt}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Step 4: try login first (existing wallet → existing account)
      let res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message, nonce }),
      });

      // If wallet not bound, fall through to signup. Server consumed the
      // nonce on the first call, so we need a fresh one.
      if (res.status === 403) {
        const nonceRes2 = await fetch("/api/auth/wallet-nonce");
        if (!nonceRes2.ok) throw new Error("nonce fetch failed");
        const { nonce: nonce2 } = await nonceRes2.json();
        const message2 =
          `${domain} 邀請你登入天道 Tian Dao\n\n` +
          `Wallet: ${address}\n` +
          `Nonce: ${nonce2}\n` +
          `Issued At: ${new Date().toISOString()}`;
        const messageBytes2 = new TextEncoder().encode(message2);
        const signatureBytes2 = await signMessage(messageBytes2);
        const signature2 = bs58.encode(signatureBytes2);
        res = await fetch("/api/auth/wallet-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, signature: signature2, message: message2, nonce: nonce2 }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error ?? (locale === "zh" ? "錢包驗證失敗" : "Wallet verification failed"));
        setFormState("error");
        return;
      }

      const { tokenHash, type, isNewUser } = await res.json();
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink",
      });
      if (otpError) {
        setErrorMessage(otpError.message);
        setFormState("error");
        return;
      }

      if (isNewUser) trackSignupComplete({ method: "phantom" });
      setFormState("success");
      router.push("/characters");
    } catch {
      setErrorMessage(locale === "zh" ? "錢包簽章失敗，請重新嘗試" : "Wallet signature failed, please retry");
      setFormState("error");
    }
  };

  const validateForm = useCallback((): string | null => {
    if (!email.trim()) return locale === "zh" ? "請輸入 Email" : "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return locale === "zh" ? "請輸入有效的 Email" : "Please enter a valid email address.";
    if (password.length < 6) return locale === "zh" ? "密碼至少 6 個字元" : "Password must be at least 6 characters.";
    if (password !== confirmPassword) return locale === "zh" ? "密碼不一致" : "Passwords do not match.";
    return null;
  }, [email, password, confirmPassword, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setFormState("submitting");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormState("error");
        setErrorMessage(error.message);
        return;
      }

      setFormState("success");
      trackSignupComplete({ method: "email" });

      setTimeout(() => {
        router.push("/characters");
      }, 800);
    } catch {
      setFormState("error");
      setErrorMessage(locale === "zh" ? "發生意外錯誤，請重新嘗試。" : "An unexpected error occurred. Please try again.");
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

      {/* Main content */}
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
          <div className="mb-4 text-center">
            <Link href="/">
              <img
                src="/images/logo-dao.png"
                alt="天道"
                className="mx-auto mb-3 h-14 w-14 rounded-xl cursor-pointer transition-transform hover:scale-105 drop-shadow-[0_0_20px_rgba(200,160,100,0.3)]"
              />
            </Link>

            <h1 className="font-heading text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              {t("signup_title")}
            </h1>
            <p className="mt-1.5 text-sm text-white/60">
              {t("signup_subtitle")}
            </p>

            <div
              className="mx-auto mt-3 h-px w-16"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(200,160,100,0.6), transparent)",
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scaleX(1)" : "scaleX(0)",
                transition: "opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s",
              }}
            />
          </div>

          {/* Signup card */}
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
              src="/images/card-bg4.png"
              alt=""
              className="w-full h-auto block"
            />
            <div
              className="absolute top-0 bottom-0 left-[10%] p-5 flex flex-col items-center justify-end"
              style={{ width: "80%" }}
            >
            {/* Google signup */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleSignup}
              disabled={formState === "submitting"}
              className="mb-3 h-11 w-full gap-3 text-sm font-medium border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {t("signup_google")}
            </Button>

            {/* Phantom wallet signup */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePhantomAuth}
              disabled={formState === "submitting"}
              className="mb-3 h-11 w-full gap-3 text-sm font-medium border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4286 64.0583C13.9696 87.5806 35.6517 108 59.4288 108H62.4282C83.3849 108 111.4 91.6816 115.78 71.7585C116.585 68.0976 113.733 64.9142 110.584 64.9142ZM39.7689 65.9454C39.7689 69.0476 37.219 71.5836 34.1014 71.5836C30.9837 71.5836 28.4338 69.0405 28.4338 65.9454V56.8615C28.4338 53.7593 30.9837 51.2233 34.1014 51.2233C37.219 51.2233 39.7689 53.7664 39.7689 56.8615V65.9454ZM59.4571 65.9454C59.4571 69.0476 56.9072 71.5836 53.7895 71.5836C50.6719 71.5836 48.1219 69.0405 48.1219 65.9454V56.8615C48.1219 53.7593 50.679 51.2233 53.7895 51.2233C56.9 51.2233 59.4571 53.7664 59.4571 56.8615V65.9454Z" fill="#AB9FF2"/>
              </svg>
              {locale === "zh" ? "用 Phantom 錢包註冊" : "Sign up with Phantom"}
            </Button>

            <div className="relative mb-3">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 px-3 text-xs text-white/40">
                {t("or")}
              </span>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 w-full">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-email" className="text-xs font-medium uppercase tracking-wider text-white/50">
                  {t("signup_email")}
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="cultivator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="email"
                  autoFocus
                  className="h-10 text-[16px] border-white/15 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-spirit-gold/50 focus-visible:shadow-[0_0_12px_rgba(200,160,100,0.15)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-password" className="text-xs font-medium uppercase tracking-wider text-white/50">
                  {t("signup_password")}
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder={t("signup_passwordHint")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-10 text-[16px] border-white/15 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-spirit-gold/50 focus-visible:shadow-[0_0_12px_rgba(200,160,100,0.15)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-confirm" className="text-xs font-medium uppercase tracking-wider text-white/50">
                  {t("signup_confirmPassword")}
                </Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder={t("signup_confirmHint")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={formState === "submitting" || formState === "success"}
                  autoComplete="new-password"
                  className="h-10 text-[16px] border-white/15 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-spirit-gold/50 focus-visible:shadow-[0_0_12px_rgba(200,160,100,0.15)]"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
                  {errorMessage}
                </div>
              )}

              {formState === "success" && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400" role="status">
                  {t("signup_success")}
                </div>
              )}

              <button
                type="submit"
                disabled={formState === "submitting" || formState === "success"}
                className="mt-1 relative w-full hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <img src="/images/btn-bg7.png" alt="" className="w-full h-auto block" />
                <span className="absolute inset-0 flex items-center justify-end pr-10 font-heading font-bold text-base text-white">
                  {formState === "submitting" ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t("signup_creating")}
                    </span>
                  ) : formState === "success" ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {t("signup_welcomeBtn")}
                    </span>
                  ) : (
                    t("signup_submit")
                  )}
                </span>
              </button>
            </form>

            <Separator className="my-3 bg-white/10" />

            <p className="text-center text-sm text-white/50">
              {t("signup_hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-spirit-gold/80 underline-offset-4 transition-all hover:text-spirit-gold hover:underline"
              >
                {t("signup_login")}
              </Link>
            </p>
            </div>
          </div>

          {/* Bottom text */}
          <p
            className="mt-4 text-center font-heading text-xs tracking-[0.3em] text-white/25"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 0.8s ease-out 0.8s",
            }}
          >
            {t("signup_bottomText")}
          </p>
        </div>
      </div>
    </div>
  );
}
