"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trackVisitLanding, trackCtaClick } from "@/lib/events";
import type { Variant } from "@/lib/variants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LandingContentProps {
  variant: Variant;
}

/* ------------------------------------------------------------------ */
/*  Features (shared across all variants)                              */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "AI Spec Generation",
    description: "Paste your idea. AI creates a complete experiment spec with hypotheses, variants, and success metrics.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "One-Click Deploy",
    description: "Launch your experiment with real landing pages, analytics, and ad campaigns. No code required.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Live Scorecard",
    description: "Watch real funnel data flow in. Conversion rates, confidence intervals, and hypothesis tracking, live.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Data-Backed Verdicts",
    description: "SCALE, REFINE, PIVOT, or KILL. A clear recommendation backed by statistical confidence, not opinions.",
  },
];

/* ------------------------------------------------------------------ */
/*  How It Works steps                                                 */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    number: "01",
    title: "Paste your idea",
    description: "Describe your startup idea in plain language. No pitch deck required.",
  },
  {
    number: "02",
    title: "AI builds your experiment",
    description: "Get a complete spec with hypotheses, success metrics, and A/B variants in seconds.",
  },
  {
    number: "03",
    title: "Deploy with one click",
    description: "Launch a live landing page, analytics, and ad campaigns. Real users, real data.",
  },
  {
    number: "04",
    title: "Receive your verdict",
    description: "In days, get a SCALE/REFINE/PIVOT/KILL verdict backed by funnel data and confidence intervals.",
  },
];

/* ------------------------------------------------------------------ */
/*  Scroll reveal hook                                                 */
/* ------------------------------------------------------------------ */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollReveal();

  useEffect(() => {
    if (!isVisible) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isVisible, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Verdict demo (interactive hero element)                            */
/* ------------------------------------------------------------------ */

function VerdictDemo() {
  const [activeVerdict, setActiveVerdict] = useState(0);
  const verdicts = [
    { label: "SCALE", color: "text-verdict-scale", bg: "bg-verdict-scale/10", border: "border-verdict-scale/30" },
    { label: "REFINE", color: "text-verdict-refine", bg: "bg-verdict-refine/10", border: "border-verdict-refine/30" },
    { label: "PIVOT", color: "text-verdict-pivot", bg: "bg-verdict-pivot/10", border: "border-verdict-pivot/30" },
    { label: "KILL", color: "text-verdict-kill", bg: "bg-verdict-kill/10", border: "border-verdict-kill/30" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVerdict((prev) => (prev + 1) % verdicts.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [verdicts.length]);

  return (
    <div className="relative flex items-center justify-center gap-3">
      {verdicts.map((v, i) => (
        <div
          key={v.label}
          className={`
            rounded-md border px-3 py-1.5 font-display text-sm tracking-wider
            transition-all duration-500
            ${i === activeVerdict
              ? `${v.bg} ${v.border} ${v.color} scale-110 shadow-lg`
              : "border-border/40 text-muted-foreground/40 scale-95 opacity-60"
            }
          `}
        >
          {v.label}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gold particle background for hero                                  */
/* ------------------------------------------------------------------ */

function HeroParticles() {
  const particles = useRef(
    Array.from({ length: 12 }).map(() => ({
      w: 2 + Math.random() * 3,
      left: 8 + Math.random() * 84,
      top: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      dur: 3 + Math.random() * 3,
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.current.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gold/20 animate-float"
          style={{
            width: `${p.w}px`,
            height: `${p.w}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LandingContent({ variant }: LandingContentProps) {
  const painReveal = useScrollReveal();
  const featuresReveal = useScrollReveal();
  const stepsReveal = useScrollReveal();
  const proofReveal = useScrollReveal();
  const finalReveal = useScrollReveal();

  // Fire visit_landing on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    trackVisitLanding({
      variant: variant.slug,
      referrer: document.referrer || undefined,
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
      utm_content: params.get("utm_content") || undefined,
      gclid: params.get("gclid") || undefined,
      click_id:
        params.get("gclid") ||
        params.get("twclid") ||
        params.get("rdt_cid") ||
        undefined,
    });
  }, [variant.slug]);

  function handleCtaClick() {
    trackCtaClick({ variant: variant.slug, cta_text: variant.cta });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ============================================================ */}
      {/*  HERO SECTION                                                 */}
      {/*  Persuasion job: Hook -- immediate value proposition          */}
      {/*  Depth: radial glow + grain overlay + floating particles      */}
      {/*  Layout: centered column with interactive verdict demo        */}
      {/* ============================================================ */}
      <section className="relative radial-glow grain-overlay">
        <HeroParticles />
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-32 md:pb-32 md:pt-44">
          <div className="mx-auto max-w-4xl text-center">
            {/* Urgency badge */}
            <div className="animate-fade-in-up stagger-1 mb-8">
              <Badge
                variant="outline"
                className="border-gold/30 bg-gold/5 text-gold px-4 py-1.5 text-sm font-sans font-medium tracking-wide"
              >
                {variant.urgency}
              </Badge>
            </div>

            {/* Headline -- display font, massive size ratio */}
            <h1 className="animate-fade-in-up stagger-2 font-display text-5xl leading-tight tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl">
              {variant.headline}
            </h1>

            {/* Subheadline */}
            <p className="animate-fade-in-up stagger-3 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {variant.subheadline}
            </p>

            {/* CTA */}
            <div className="animate-fade-in-up stagger-4 mt-10">
              <Link href="/assay" onClick={handleCtaClick}>
                <Button
                  size="lg"
                  className="animate-glow-breathe bg-gold text-accent-foreground px-10 py-6 text-lg font-sans font-semibold tracking-wide shadow-lg transition-all hover:bg-gold-bright hover:scale-[1.02] hover:shadow-xl"
                >
                  {variant.cta}
                </Button>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                No signup required to start. Free to try.
              </p>
            </div>

            {/* Interactive verdict demo */}
            <div className="animate-fade-in-up stagger-5 mt-14">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-mineral">
                Your idea gets one of four verdicts
              </p>
              <VerdictDemo />
            </div>
          </div>
        </div>

        {/* Section transition: gold gradient rule */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </section>

      {/* ============================================================ */}
      {/*  PAIN POINTS SECTION                                          */}
      {/*  Persuasion job: Agitate -- activate the problem              */}
      {/*  Depth: glass cards with warm shadows                         */}
      {/*  Layout: asymmetric 3-column grid (breaks centered pattern)   */}
      {/* ============================================================ */}
      <section className="relative py-24 md:py-32">
        <div
          ref={painReveal.ref}
          className={`mx-auto max-w-6xl px-6 transition-all duration-700 ${
            painReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-verdict-kill/40 to-transparent" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-verdict-kill/70">
              Sound familiar?
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-verdict-kill/40 to-transparent" />
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {variant.pain_points.map((pain, i) => (
              <Card
                key={i}
                className={`group glass-card border-border/30 transition-all duration-300 hover:-translate-y-1 hover:border-verdict-kill/20 hover:shadow-lg ${
                  painReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: painReveal.isVisible ? `${200 + i * 150}ms` : "0ms",
                }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-verdict-kill/10">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-verdict-kill" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-base leading-relaxed text-foreground/90">
                    {pain}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS SECTION                                         */}
      {/*  Persuasion job: Solution -- show the path                    */}
      {/*  Depth: numbered steps with connecting line + gradient bg     */}
      {/*  Layout: vertical timeline with left-aligned numbers          */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Subtle background shift */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/50 to-transparent" />

        <div
          ref={stepsReveal.ref}
          className="relative z-10 mx-auto max-w-5xl px-6"
        >
          <div className="mb-16 text-center">
            <h2 className={`font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl transition-all duration-700 ${
              stepsReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}>
              Idea to verdict in four steps
            </h2>
            <p className={`mx-auto mt-4 max-w-xl text-lg text-muted-foreground transition-all duration-700 delay-100 ${
              stepsReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}>
              The entire process takes under 30 minutes. Your first experiment is free.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-0 bottom-0 hidden w-px bg-gradient-to-b from-gold/40 via-gold/20 to-transparent md:block" />

            <div className="space-y-12 md:space-y-16">
              {STEPS.map((step, i) => (
                <div
                  key={step.number}
                  className={`flex items-start gap-6 md:gap-10 transition-all duration-700 ${
                    stepsReveal.isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                  }`}
                  style={{
                    transitionDelay: stepsReveal.isVisible ? `${300 + i * 150}ms` : "0ms",
                  }}
                >
                  {/* Step number */}
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-card shadow-md">
                    <span className="font-display text-2xl text-gold">{step.number}</span>
                  </div>

                  {/* Step content */}
                  <div className="pt-2">
                    <h3 className="font-display text-xl text-foreground md:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section transition */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </section>

      {/* ============================================================ */}
      {/*  FEATURES SECTION                                             */}
      {/*  Persuasion job: Convince -- capability showcase               */}
      {/*  Depth: elevated cards with gold hover glow                   */}
      {/*  Layout: 2x2 grid (different from previous sections)          */}
      {/* ============================================================ */}
      <section className="relative py-24 md:py-32">
        <div
          ref={featuresReveal.ref}
          className="mx-auto max-w-6xl px-6"
        >
          <div className="mb-16 text-center">
            <h2 className={`font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl transition-all duration-700 ${
              featuresReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}>
              Everything you need to validate
            </h2>
            <p className={`mx-auto mt-4 max-w-xl text-lg text-muted-foreground transition-all duration-700 delay-100 ${
              featuresReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}>
              {variant.promise}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Card
                key={feature.title}
                className={`group border-border/30 bg-card/80 transition-all duration-500 hover:-translate-y-1 hover:border-gold/20 hover:shadow-lg hover:shadow-glow-gold ${
                  featuresReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: featuresReveal.isVisible ? `${200 + i * 120}ms` : "0ms",
                }}
              >
                <CardContent className="p-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-xl text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SOCIAL PROOF SECTION                                         */}
      {/*  Persuasion job: Prove -- build trust and reduce risk          */}
      {/*  Depth: counters + testimonial card with glass effect          */}
      {/*  Layout: stats row + centered proof card (unique layout)      */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Background: subtle warm glow from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-gold/[0.03] to-transparent" />

        <div
          ref={proofReveal.ref}
          className="relative z-10 mx-auto max-w-6xl px-6"
        >
          {/* Stats row */}
          <div className={`grid grid-cols-2 gap-8 md:grid-cols-4 transition-all duration-700 ${
            proofReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            {[
              { value: 500, suffix: "+", label: "Ideas validated" },
              { value: 5, suffix: " days", label: "Average time to verdict" },
              { value: 93, suffix: "%", label: "KILL accuracy" },
              { value: 30, suffix: " min", label: "Setup time" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="text-center"
                style={{ transitionDelay: proofReveal.isVisible ? `${i * 100}ms` : "0ms" }}
              >
                <div className="font-display text-4xl text-gold md:text-5xl">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Proof statement */}
          <div className={`mx-auto mt-16 max-w-2xl transition-all duration-700 delay-300 ${
            proofReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            <Card className="glass-card border-gold/10 overflow-hidden">
              <CardContent className="relative p-8 text-center md:p-10">
                <div className="absolute -top-1 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent" />
                <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-4 h-8 w-8 text-gold/30">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
                </svg>
                <p className="font-display text-xl leading-snug text-foreground md:text-2xl">
                  {variant.proof}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section transition */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </section>

      {/* ============================================================ */}
      {/*  FINAL CTA SECTION                                            */}
      {/*  Persuasion job: Close -- drive action                        */}
      {/*  Depth: radial glow + strong gold accent                      */}
      {/*  Layout: tight centered block with emphasis                   */}
      {/* ============================================================ */}
      <section className="relative py-24 md:py-32">
        <div className="absolute inset-0 radial-glow opacity-50" />

        <div
          ref={finalReveal.ref}
          className={`relative z-10 mx-auto max-w-3xl px-6 text-center transition-all duration-700 ${
            finalReveal.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {variant.headline}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {variant.subheadline}
          </p>

          <div className="mt-10">
            <Link href="/assay" onClick={handleCtaClick}>
              <Button
                size="lg"
                className="animate-glow-breathe bg-gold text-accent-foreground px-12 py-6 text-lg font-sans font-semibold tracking-wide shadow-lg transition-all hover:bg-gold-bright hover:scale-[1.02] hover:shadow-xl"
              >
                {variant.cta}
              </Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Free to try. No credit card required.
            </p>
          </div>

          {/* Urgency closer */}
          <p className="mt-10 text-sm font-medium text-gold-dim italic">
            {variant.urgency}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg text-foreground">Assayer</span>
              <span className="text-xs text-muted-foreground">by Magpie</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The verdict machine for startup ideas.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
