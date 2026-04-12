"use client";

import { useI18n } from "@/lib/i18n";

type Variant = "floating" | "inline";

export function LanguageToggle({ variant = "floating" }: { variant?: Variant }) {
  const { locale, setLocale } = useI18n();

  if (variant === "inline") {
    return (
      <button
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
      >
        <span className="text-base leading-none">🌐</span>
        <span>{locale === "zh" ? "English" : "中文"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      className="absolute right-5 top-5 z-20 hover:scale-[1.05] transition-transform cursor-pointer"
      style={{ width: '72px', height: '72px' }}
    >
      <img src="/images/btn-bg8.png" alt="" className="w-full h-full object-contain" />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-heading font-bold text-white">
        {locale === "zh" ? "EN" : "中"}
      </span>
    </button>
  );
}
