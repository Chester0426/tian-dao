// Variant definitions derived from experiment.yaml
// Used by landing page routing (root + /v/[slug])

export interface Variant {
  slug: string;
  headline: string;
  subheadline: string;
  cta: string;
  promise: string;
  proof: string;
  urgency: string;
  pain_points: string[];
}

export const variants: Variant[] = [
  {
    slug: "verdict-machine",
    headline: "Know if it\u2019s gold before you dig.",
    subheadline:
      "Paste your idea. Get a live experiment and a data-backed verdict in days.",
    cta: "Test My Idea",
    promise:
      "A clear SCALE/REFINE/PIVOT/KILL verdict backed by real user data",
    proof: "Built on the same validation framework used by Y Combinator founders",
    urgency:
      "Every week without validation is a week building the wrong thing",
    pain_points: [
      "You spent months building something nobody wanted",
      "Surveys and interviews give you opinions, not data",
      "Setting up analytics, ads, and landing pages takes weeks",
    ],
  },
  {
    slug: "time-saver",
    headline: "Stop building the wrong thing.",
    subheadline:
      "From idea to validated experiment in 30 minutes. No code, no guesswork.",
    cta: "Validate in 30 Minutes",
    promise: "Skip months of building to find out if your idea has legs",
    proof: "Founders validated 500+ ideas in beta \u2014 average time to verdict: 5 days",
    urgency: "Your runway is burning. Get answers before you run out",
    pain_points: [
      "Building an MVP takes weeks even with no-code tools",
      "You don\u2019t know if low traction means bad idea or bad execution",
      "Pivoting after launch wastes months of effort",
    ],
  },
  {
    slug: "data-driven",
    headline: "Data-backed verdicts in days, not months.",
    subheadline:
      "AI generates your experiment. Real users deliver the verdict.",
    cta: "Get My Verdict",
    promise:
      "Replace gut feelings with funnel data and statistical confidence",
    proof: "93% of ideas that scored KILL would have failed within 6 months",
    urgency:
      "The market won\u2019t wait \u2014 validate now or watch someone else win",
    pain_points: [
      "You\u2019re making bet-the-company decisions on gut feeling",
      "A/B testing requires traffic you don\u2019t have yet",
      "Analytics tools show you what happened, not what to do",
    ],
  },
];

export const defaultVariant = variants[0];

export function getVariantBySlug(slug: string): Variant | undefined {
  return variants.find((v) => v.slug === slug);
}
