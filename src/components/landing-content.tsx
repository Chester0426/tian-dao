"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { trackVisitLanding, trackCtaClick } from "@/lib/events";
import type { Variant } from "@/lib/variants";
import {
  FlaskConical,
  Sparkles,
  BarChart3,
  Zap,
  ArrowRight,
  Clock,
  Target,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

// ---------- How It Works steps (shared across variants) ----------
const STEPS = [
  {
    number: "01",
    title: "Paste your idea",
    description:
      "Describe your startup idea in plain language. No templates, no forms, no friction.",
    icon: Sparkles,
    accent: "text-gold",
    gradient: "from-gold/20 to-transparent",
    bg: "bg-gold/[0.08]",
    border: "border-gold/20",
  },
  {
    number: "02",
    title: "AI builds your experiment",
    description:
      "Watch as AI generates a testable spec: landing page, analytics, distribution plan.",
    icon: Zap,
    accent: "text-ember",
    gradient: "from-ember/20 to-transparent",
    bg: "bg-ember/[0.08]",
    border: "border-ember/20",
  },
  {
    number: "03",
    title: "Real users, real data",
    description:
      "Your experiment goes live. Ads run, visitors arrive, funnels track every click.",
    icon: BarChart3,
    accent: "text-mineral",
    gradient: "from-mineral/20 to-transparent",
    bg: "bg-mineral/[0.08]",
    border: "border-mineral/20",
  },
  {
    number: "04",
    title: "Get your verdict",
    description:
      "SCALE, REFINE, PIVOT, or KILL \u2014 backed by statistical confidence, not gut feeling.",
    icon: Target,
    accent: "text-gold-bright",
    gradient: "from-gold-bright/20 to-transparent",
    bg: "bg-gold-bright/[0.08]",
    border: "border-gold-bright/20",
  },
];

// ---------- Social proof metrics ----------
const PROOF_METRICS = [
  { value: "500+", label: "Ideas validated in beta", numericEnd: 500 },
  { value: "5 days", label: "Average time to verdict", numericEnd: 5 },
  { value: "30 min", label: "Idea to live experiment", numericEnd: 30 },
  { value: "93%", label: "KILL accuracy rate", numericEnd: 93 },
];

// ---------- Trust signals ----------
const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Bank-grade security",
    description: "Your ideas are encrypted and never shared.",
  },
  {
    icon: Clock,
    title: "Cancel anytime",
    description: "No contracts. Pay only when you run experiments.",
  },
  {
    icon: TrendingUp,
    title: "Real traffic, real data",
    description: "We use actual paid channels, not simulated users.",
  },
];

// ---------- Verdict demo badges ----------
const VERDICTS = [
  {
    label: "SCALE",
    className: "verdict-scale",
    icon: CheckCircle2,
    description: "All metrics exceeded thresholds",
  },
  {
    label: "REFINE",
    className: "verdict-refine",
    icon: AlertTriangle,
    description: "Promising, needs iteration",
  },
  {
    label: "PIVOT",
    className: "verdict-pivot",
    icon: ArrowRight,
    description: "Core concept, different approach",
  },
  {
    label: "KILL",
    className: "verdict-kill",
    icon: XCircle,
    description: "Stop before you waste more",
  },
];

// ---------- Scroll-reveal hook ----------
// Content starts VISIBLE (opacity:1) for SSR/screenshots.
// On mount, JS hides it; IntersectionObserver then reveals with animation.
// This ensures full-page screenshots always show content.
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [jsReady, setJsReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mark JS as ready -- this hides sections so they can animate in
    setJsReady(true);

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  // If JS hasn't loaded yet (SSR / screenshot), treat as visible
  const isVisible = !jsReady || visible;

  return { ref, visible: isVisible };
}

// ---------- Animated counter hook ----------
function useCounter(end: number, duration: number, trigger: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let startTime: number | null = null;
    let rafId: number;

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration, trigger]);

  return count;
}

// ---------- Main component ----------
export function LandingContent({ variant }: { variant: Variant }) {
  // Track visit_landing on mount
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
    trackCtaClick({ variant: variant.slug });
  }

  // Scroll reveals
  const painRef = useScrollReveal(0.12);
  const stepsRef = useScrollReveal(0.1);
  const proofRef = useScrollReveal(0.15);
  const verdictRef = useScrollReveal(0.15);
  const trustRef = useScrollReveal(0.15);
  const finalRef = useScrollReveal(0.15);

  // Counter animations for proof metrics
  const proofCount500 = useCounter(500, 1800, proofRef.visible);
  const proofCount5 = useCounter(5, 1200, proofRef.visible);
  const proofCount30 = useCounter(30, 1400, proofRef.visible);
  const proofCount93 = useCounter(93, 1600, proofRef.visible);

  return (
    <main className="relative overflow-hidden">
      {/* ============================================================
          HERO SECTION
          Persuasion: Hook -- outcome-oriented headline + immediate CTA
          Depth: animated gradient mesh + noise + floating orbs
          Layout: Asymmetric two-column at lg, stacked mobile
          Animation: staggered fade-in-up (page entrance choreography)
          ============================================================ */}
      <section className="relative min-h-[calc(100vh-3.5rem)] bg-molten noise-overlay">
        {/* Animated gradient mesh background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Primary gold orb - animated float */}
          <div className="animate-float absolute -top-24 right-1/4 h-[500px] w-[500px] rounded-full bg-gold/[0.06] blur-[100px]" />
          {/* Ember orb - counter-phase float */}
          <div className="animate-float absolute bottom-1/4 -left-32 h-[400px] w-[400px] rounded-full bg-ember/[0.07] blur-[80px]" style={{ animationDelay: "-2s" }} />
          {/* Mineral accent orb */}
          <div className="animate-ember-pulse absolute top-1/3 right-0 h-[300px] w-[300px] rounded-full bg-mineral/[0.04] blur-[60px]" />
          {/* Animated gradient line along the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] animate-gradient-shift bg-gradient-to-r from-transparent via-gold/40 to-transparent" style={{ backgroundSize: "200% 100%" }} />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-16 md:pt-32 md:pb-24 lg:min-h-[calc(100vh-3.5rem)] lg:flex-row lg:items-center lg:gap-16 lg:pt-0 lg:pb-0">
          {/* Left column: Copy */}
          <div className="flex max-w-2xl flex-col items-center text-center lg:max-w-none lg:flex-1 lg:items-start lg:text-left">
            <Badge
              variant="outline"
              className="animate-fade-in-up stagger-1 mb-6 gap-1.5 border-gold/30 bg-gold/[0.06] px-3 py-1 text-gold"
            >
              <FlaskConical className="size-3.5" />
              Idea Validation Engine
            </Badge>

            <h1 className="animate-fade-in-up stagger-2 max-w-[14ch] text-5xl leading-[1.05] tracking-tight md:text-7xl lg:text-[5.2rem]">
              {variant.headline}
            </h1>

            <p className="animate-fade-in-up stagger-3 mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
              {variant.subheadline}
            </p>

            <div className="animate-fade-in-up stagger-4 mt-10 flex flex-col items-center gap-4 sm:flex-row lg:items-start">
              <Link
                href="/assay"
                onClick={handleCtaClick}
                className="group glow-gold inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-8 text-base font-semibold text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-[0_0_32px_var(--glow-gold)] active:scale-[0.98]"
              >
                {variant.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-sm text-muted-foreground">
                Free to start &middot; No credit card required
              </span>
            </div>

            {/* Urgency line */}
            <p className="animate-fade-in-up stagger-5 mt-8 text-sm italic text-ash">
              {variant.urgency}
            </p>
          </div>

          {/* Right column: Interactive verdict demo card */}
          <div className="animate-fade-in-up stagger-5 mt-16 w-full max-w-md lg:mt-0 lg:flex-shrink-0">
            <HeroVerdictCard />
          </div>
        </div>
      </section>

      {/* Visible divider */}
      <div className="section-divider" />

      {/* ============================================================
          PAIN POINTS SECTION
          Persuasion: Activate pain -- empathy-driven problem statements
          Depth: elevated surface + glass cards with red accent icons
          Layout: 3-column grid
          Animation: scale-up-reveal (different from hero's fade-in-up)
          ============================================================ */}
      <section
        ref={painRef.ref}
        className="relative bg-crucible-elevated py-24 md:py-32"
      >
        {/* Subtle ember glow in top-left corner for warmth */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-[300px] w-[300px] rounded-full bg-ember/[0.06] blur-[80px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div
            className={`mx-auto mb-16 max-w-2xl text-center transition-all duration-700 ${
              painRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0"
            }`}
          >
            <h2 className="text-3xl md:text-5xl">Sound familiar?</h2>
            <p className="mt-4 text-muted-foreground">
              Most founders learn these lessons the hard way.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {variant.pain_points.map((pain, i) => (
              <div
                key={i}
                className={`card-lift rounded-xl border border-border/50 bg-card/60 p-8 backdrop-blur-sm transition-all duration-500 ${
                  painRef.visible
                    ? "scale-100 opacity-100"
                    : "scale-95 opacity-0"
                }`}
                style={{
                  transitionDelay: painRef.visible ? `${150 + i * 120}ms` : "0ms",
                }}
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                  <XCircle className="size-5 text-destructive" />
                </div>
                <p className="text-lg font-medium leading-snug">{pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ============================================================
          HOW IT WORKS SECTION
          Persuasion: Show the path -- golden path visualization
          Depth: numbered cards with distinct accent colors + connection line
          Layout: Offset alternating layout (breaks grid pattern above)
          Animation: slide-in-left / slide-in-right (alternating per step)
          ============================================================ */}
      <section ref={stepsRef.ref} className="relative bg-crucible-deep py-24 md:py-32">
        {/* Background: gold gradient wash */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-gold/[0.04] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6">
          <div
            className={`mx-auto mb-20 max-w-2xl text-center transition-all duration-700 ${
              stepsRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0"
            }`}
          >
            <Badge
              variant="outline"
              className="mb-4 gap-1.5 border-gold/30 bg-gold/[0.06] px-3 py-1 text-gold"
            >
              <Zap className="size-3.5" />
              How It Works
            </Badge>
            <h2 className="text-3xl md:text-5xl">
              From idea to verdict in 4 steps
            </h2>
          </div>

          {/* Steps with alternating offset layout */}
          <div className="relative">
            {/* Vertical connection line (desktop) */}
            <div className="absolute left-1/2 top-0 bottom-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-gold/30 via-ember/20 to-mineral/30 lg:block" aria-hidden="true" />

            <div className="space-y-12 lg:space-y-0">
              {STEPS.map((step, i) => {
                const isLeft = i % 2 === 0;
                return (
                  <div
                    key={step.number}
                    className={`relative transition-all duration-700 lg:flex lg:items-center lg:py-10 ${
                      isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
                    } ${
                      stepsRef.visible
                        ? "translate-x-0 opacity-100"
                        : isLeft
                        ? "-translate-x-8 opacity-0"
                        : "translate-x-8 opacity-0"
                    }`}
                    style={{
                      transitionDelay: stepsRef.visible
                        ? `${200 + i * 150}ms`
                        : "0ms",
                    }}
                  >
                    {/* Step content */}
                    <div
                      className={`flex-1 ${
                        isLeft
                          ? "lg:pr-16 lg:text-right"
                          : "lg:pl-16 lg:text-left"
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-3 ${
                          isLeft
                            ? "lg:flex-row-reverse"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex size-12 items-center justify-center rounded-xl ${step.bg} border ${step.border}`}
                        >
                          <step.icon className={`size-5 ${step.accent}`} />
                        </div>
                        <span className="font-display text-4xl text-muted-foreground/30">
                          {step.number}
                        </span>
                      </div>
                      <h3 className="mt-4 text-2xl md:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-sm text-muted-foreground lg:max-w-md">
                        {step.description}
                      </p>
                    </div>

                    {/* Center dot on the connection line (desktop) */}
                    <div className="relative z-10 hidden lg:flex lg:items-center lg:justify-center">
                      <div
                        className={`size-4 rounded-full border-2 border-background ${
                          i === 0
                            ? "bg-gold"
                            : i === 1
                            ? "bg-ember"
                            : i === 2
                            ? "bg-mineral"
                            : "bg-gold-bright"
                        }`}
                      />
                    </div>

                    {/* Spacer to balance the two-column layout */}
                    <div className="hidden flex-1 lg:block" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ============================================================
          VERDICT SHOWCASE SECTION
          Persuasion: Demonstrate the output -- show what they get
          Depth: verdict badge cards with distinct color treatments
          Layout: 4-column grid with promise callout beneath
          Animation: staggered scale-up (different from fade and slide)
          ============================================================ */}
      <section
        ref={verdictRef.ref}
        className="relative bg-crucible-elevated py-24 md:py-32"
      >
        {/* Subtle radial glow behind the cards */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.04] blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div
            className={`mx-auto mb-16 max-w-2xl text-center transition-all duration-700 ${
              verdictRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0"
            }`}
          >
            <h2 className="text-3xl md:text-5xl">
              Four verdicts. Zero ambiguity.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every experiment ends with a clear recommendation backed by
              statistical confidence.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERDICTS.map((v, i) => (
              <div
                key={v.label}
                className={`group card-lift rounded-xl border border-border/50 bg-card/60 p-6 text-center backdrop-blur-sm transition-all duration-500 ${
                  verdictRef.visible
                    ? "scale-100 opacity-100"
                    : "scale-90 opacity-0"
                }`}
                style={{
                  transitionDelay: verdictRef.visible
                    ? `${200 + i * 100}ms`
                    : "0ms",
                }}
              >
                <div className="mx-auto mb-4 flex size-12 items-center justify-center">
                  <v.icon
                    className={`size-7 ${
                      v.label === "SCALE"
                        ? "text-verdict-scale"
                        : v.label === "REFINE"
                        ? "text-verdict-refine"
                        : v.label === "PIVOT"
                        ? "text-verdict-pivot"
                        : "text-verdict-kill"
                    }`}
                  />
                </div>
                <Badge
                  variant="outline"
                  className={`${v.className} mb-3 border px-3 py-1 text-sm font-semibold`}
                >
                  {v.label}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {v.description}
                </p>
              </div>
            ))}
          </div>

          {/* Promise callout */}
          <div
            className={`mt-12 rounded-xl border border-gold/20 bg-gold/[0.06] p-8 text-center transition-all duration-700 ${
              verdictRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
            style={{
              transitionDelay: verdictRef.visible ? "700ms" : "0ms",
            }}
          >
            <p className="font-display text-xl italic text-gold md:text-2xl">
              &ldquo;{variant.promise}&rdquo;
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ============================================================
          SOCIAL PROOF SECTION
          Persuasion: Build credibility -- metrics + proof statement
          Depth: animated counters + glowing stat containers
          Layout: Full-width 4-stat bar with bordered cards
          Animation: counter roll-up (unique numeric animation)
          ============================================================ */}
      <section
        ref={proofRef.ref}
        className="relative overflow-hidden bg-crucible-deep py-24 md:py-32"
      >
        {/* Ambient dual glow */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-x-0 top-1/2 h-64 -translate-y-1/2 bg-gradient-to-r from-gold/[0.06] via-transparent to-ember/[0.06]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div
            className={`grid grid-cols-2 gap-6 md:grid-cols-4 transition-all duration-700 ${
              proofRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
          >
            {PROOF_METRICS.map((metric, i) => {
              const counters = [proofCount500, proofCount5, proofCount30, proofCount93];
              const suffixes = ["+", " days", " min", "%"];
              return (
                <div
                  key={metric.label}
                  className="rounded-xl border border-border/40 bg-card/30 p-6 text-center backdrop-blur-sm"
                  style={{
                    transitionDelay: proofRef.visible
                      ? `${i * 120}ms`
                      : "0ms",
                  }}
                >
                  <div className="font-display text-4xl text-gold md:text-5xl">
                    {proofRef.visible ? counters[i] : 0}{suffixes[i]}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {metric.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Variant proof statement */}
          <div
            className={`mt-16 text-center transition-all duration-700 ${
              proofRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
            style={{ transitionDelay: proofRef.visible ? "500ms" : "0ms" }}
          >
            <p className="text-lg text-muted-foreground md:text-xl">
              {variant.proof}
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ============================================================
          TRUST SIGNALS SECTION
          Persuasion: Handle objections -- security, commitment, data
          Depth: icon-left cards with gold accent borders
          Layout: 3-column horizontal cards
          Animation: slide-in-left (horizontal entrance, different from others)
          ============================================================ */}
      <section
        ref={trustRef.ref}
        className="relative bg-crucible-elevated py-24 md:py-32"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div
            className={`mx-auto mb-16 max-w-2xl text-center transition-all duration-700 ${
              trustRef.visible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0"
            }`}
          >
            <h2 className="text-3xl md:text-5xl">Built for founders who ship</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {TRUST_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className={`flex items-start gap-4 rounded-xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm transition-all duration-600 ${
                  trustRef.visible
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-6 opacity-0"
                }`}
                style={{
                  transitionDelay: trustRef.visible
                    ? `${200 + i * 150}ms`
                    : "0ms",
                }}
              >
                <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.08]">
                  <item.icon className="size-5 text-gold" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ============================================================
          FINAL CTA SECTION
          Persuasion: Close -- urgency + repeated CTA
          Depth: molten gradient + glow button + noise overlay + floating orbs
          Layout: Centered full-width (dramatic conclusion)
          Animation: scale-up with glow pulse
          ============================================================ */}
      <section
        ref={finalRef.ref}
        className="relative bg-molten noise-overlay py-24 md:py-40"
      >
        {/* Decorative glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-ember-pulse absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.08] blur-[120px]" />
          <div className="animate-float absolute right-1/4 top-1/4 h-[200px] w-[200px] rounded-full bg-ember/[0.06] blur-[60px]" />
        </div>

        <div
          className={`relative z-10 mx-auto max-w-3xl px-6 text-center transition-all duration-700 ${
            finalRef.visible
              ? "scale-100 opacity-100"
              : "scale-95 opacity-0"
          }`}
        >
          <h2 className="text-3xl md:text-5xl">
            Stop guessing. Start knowing.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            {variant.subheadline}
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/assay"
              onClick={handleCtaClick}
              className="group glow-gold inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-8 text-base font-semibold text-accent-foreground transition-all hover:bg-accent/90 hover:shadow-[0_0_32px_var(--glow-gold)] active:scale-[0.98]"
            >
              {variant.cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChevronRight className="size-3.5 text-gold" />
              Free to start &middot; No credit card required
            </span>
          </div>

          {/* Urgency */}
          <p className="mt-8 text-sm italic text-ash">{variant.urgency}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FlaskConical className="size-4 text-gold" />
            <span className="font-display">Assayer</span>
          </div>
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Assayer
          </span>
        </div>
      </footer>
    </main>
  );
}

// ---------- Hero interactive card (micro-interaction) ----------
function HeroVerdictCard() {
  const [activeVerdict, setActiveVerdict] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveVerdict((prev) => (prev + 1) % VERDICTS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const current = VERDICTS[activeVerdict];

  return (
    <div className="glass rounded-2xl border border-border/50 p-6">
      {/* Terminal-style header */}
      <div className="mb-5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-destructive/60" />
          <div className="size-2.5 rounded-full bg-gold/60" />
          <div className="size-2.5 rounded-full bg-verdict-scale/60" />
        </div>
        <span className="ml-2 text-xs text-muted-foreground">
          experiment_result.json
        </span>
      </div>

      {/* Simulated output */}
      <div className="space-y-3 font-mono text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">status</span>
          <Badge variant="outline" className="border-verdict-scale/30 bg-verdict-scale/10 text-verdict-scale text-xs">
            complete
          </Badge>
        </div>
        <div className="h-px bg-border/50" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">visitors</span>
          <span className="text-foreground">1,247</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">signups</span>
          <span className="text-foreground">89</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">conversion</span>
          <span className="text-gold">7.1%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">confidence</span>
          <span className="text-foreground">95.2%</span>
        </div>
        <div className="h-px bg-border/50" />

        {/* Animated verdict display */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">verdict</span>
          <Badge
            variant="outline"
            className={`${current.className} border px-3 py-1 text-sm font-bold transition-all duration-300`}
          >
            {current.label}
          </Badge>
        </div>
      </div>

      {/* Verdict selector dots */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {VERDICTS.map((v, i) => (
          <button
            key={v.label}
            onClick={() => {
              setActiveVerdict(i);
              setIsAutoPlaying(false);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeVerdict
                ? "w-6 bg-gold"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Show ${v.label} verdict`}
          />
        ))}
      </div>
    </div>
  );
}
