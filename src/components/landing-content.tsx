"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VariantContent } from "@/lib/variants";
import { trackVisitLanding } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

function InkParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${4 + i * 2}px`,
            height: `${4 + i * 2}px`,
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            background: `var(--ink-${(i % 5) + 1})`,
            opacity: 0.12 + (i % 3) * 0.05,
            animation: `float-particle ${6 + i * 1.5}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LandingContent({
  variant,
}: {
  variant: VariantContent;
}) {
  const heroReveal = useScrollReveal(0.1);

  useEffect(() => {
    trackVisitLanding({
      variant: variant.slug,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utm_medium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
      gclid: new URLSearchParams(window.location.search).get("gclid") ?? undefined,
      click_id:
        new URLSearchParams(window.location.search).get("gclid") ??
        new URLSearchParams(window.location.search).get("twclid") ??
        new URLSearchParams(window.location.search).get("rdt_cid") ??
        undefined,
      utm_content: new URLSearchParams(window.location.search).get("utm_content") ?? undefined,
    });
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* HERO — Full viewport, mist gradient, ink noise, floating particles */}
      <section
        ref={heroReveal.ref}
        className="ink-noise mist-gradient relative flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-24 pt-16 md:px-12 lg:px-16"
      >
        <InkParticles />

        {/* Decorative mist bands */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute left-0 top-[60%] h-32 w-full"
            style={{
              background: "linear-gradient(90deg, transparent, var(--jade-dim), transparent)",
              opacity: 0.3,
              animation: "mist-drift 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute left-0 top-[75%] h-24 w-full"
            style={{
              background: "linear-gradient(90deg, transparent, var(--ink-5), transparent)",
              opacity: 0.2,
              animation: "mist-drift 16s ease-in-out infinite reverse",
            }}
          />
        </div>

        <div
          className="relative z-10 flex max-w-4xl flex-col items-center text-center"
          style={{
            transform: heroReveal.revealed ? "translateY(0)" : "translateY(24px)",
            filter: heroReveal.revealed ? "blur(0)" : "blur(2px)",
            transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <Badge
            variant="outline"
            className="mb-8 border-jade/30 bg-jade-dim px-4 py-1.5 text-sm font-medium text-jade"
          >
            <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-jade" />
            修仙放置 RPG
          </Badge>

          <h1
            className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {variant.headline}
          </h1>

          <div
            className="my-6 h-px w-48 md:w-64"
            style={{
              background: "linear-gradient(90deg, transparent, var(--cinnabar), transparent)",
              animation: heroReveal.revealed ? "brush-reveal 1.2s ease-out 0.4s both" : "none",
            }}
          />

          <p
            className="max-w-2xl text-lg leading-relaxed text-ink-3 md:text-xl"
            style={{
              transform: heroReveal.revealed ? "translateY(0)" : "translateY(16px)",
              filter: heroReveal.revealed ? "blur(0)" : "blur(1px)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, filter 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
            }}
          >
            {variant.subheadline}
          </p>

          <p
            className="mt-3 text-sm font-medium tracking-wide text-spirit-gold text-glow-gold"
            style={{
              transform: heroReveal.revealed ? "translateY(0)" : "translateY(12px)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.35s",
            }}
          >
            {variant.promise}
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            style={{
              transform: heroReveal.revealed ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.45s",
            }}
          >
            <Link href="/signup">
              <Button
                className="seal-glow h-12 px-8 text-base font-bold transition-all duration-200 hover:scale-[1.03] hover:brightness-110"
                size="lg"
              >
                {variant.cta}
              </Button>
            </Link>
            <span className="text-sm text-ink-3">
              免費開始，無需信用卡
            </span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-border/50 px-6 py-12 text-center">
        <div className="mx-auto max-w-md">
          <p className="font-heading text-lg font-bold text-cinnabar/60">
            天道
          </p>
          <div
            className="mx-auto my-3 h-px w-16"
            style={{ background: "linear-gradient(90deg, transparent, var(--ink-4), transparent)" }}
          />
          <p className="text-xs text-ink-4">
            &copy; {new Date().getFullYear()} Tian Dao. 修仙放置 RPG.
          </p>
        </div>
      </footer>
    </div>
  );
}
