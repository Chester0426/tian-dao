"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="relative flex h-screen overflow-hidden">
      {/* Background image with dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/Gemini_Generated_Image_l3pzrrl3pzrrl3pz.png')",
          opacity: mounted ? 1 : 0,
          transition: "opacity 1.5s ease-out",
        }}
      />
      {/* Dark overlay to blend with dark theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      {/* Extra vignette on edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]" />

      {/* Language toggle — top right */}
      <button
        type="button"
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        className="absolute right-5 top-5 z-20 rounded-full border border-white/20 bg-black/30 px-5 py-2 text-sm font-medium text-white/70 backdrop-blur-sm transition-colors hover:text-white hover:border-white/40"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.6s ease-out 0.3s, color 0.2s, border-color 0.2s",
        }}
      >
        {locale === "zh" ? "English" : "中文"}
      </button>

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

          {/* Login card — glass morphism */}
          <div
            className="rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s ease-out 0.35s, transform 0.6s ease-out 0.35s",
            }}
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

            <div className="relative mb-4">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 px-3 text-xs text-white/40">
                {t("or")}
              </span>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-1 h-11 text-base font-medium seal-glow transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                    {t("login_logging")}
                  </span>
                ) : (
                  t("login_submit")
                )}
              </Button>
            </form>

            <Separator className="my-4 bg-white/10" />

            <p className="text-center text-sm text-white/50">
              {t("login_noAccount")}{" "}
              <Link
                href="/signup"
                className="font-medium text-spirit-gold/80 underline-offset-4 transition-all hover:text-spirit-gold hover:underline"
              >
                {t("login_signup")}
              </Link>
            </p>
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
