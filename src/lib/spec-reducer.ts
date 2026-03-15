export type FullSpecData = Record<string, unknown>;

export type SpecStreamEvent =
  | { type: "meta"; name: string; level: number; experiment_type: string }
  | {
      type: "cost";
      build_cost: number;
      ad_budget: number;
      estimated_days: number;
    }
  | {
      type: "preflight";
      dimension: "market" | "problem" | "competition" | "icp";
      status: "pass" | "caution" | "fail";
      summary: string;
      confidence: string;
    }
  | { type: "preflight_opinion"; text: string }
  | {
      type: "hypothesis";
      id: string;
      category: string;
      statement: string;
      metric: {
        formula: string;
        threshold: number;
        operator: "gt" | "gte" | "lt" | "lte";
      };
      priority_score: number;
      experiment_level: number;
      depends_on: string[];
    }
  | {
      type: "variant";
      slug: string;
      headline: string;
      subheadline: string;
      cta: string;
      pain_points: string[];
      promise: string;
      proof: string;
      urgency: string | null;
    }
  | { type: "funnel"; available_from: Record<string, string> }
  | { type: "complete"; spec: FullSpecData; anonymous_spec_id: string }
  | { type: "input_too_vague" }
  | { type: "error"; message: string };

export type SpecState = {
  status: "idle" | "streaming" | "complete" | "too_vague" | "error";
  meta: { name: string; level: number; experiment_type: string } | null;
  cost: {
    build_cost: number;
    ad_budget: number;
    estimated_days: number;
  } | null;
  preflight: Array<{
    dimension: string;
    status: string;
    summary: string;
    confidence: string;
  }>;
  preflightOpinion: string | null;
  hypotheses: Array<SpecStreamEvent & { type: "hypothesis" }>;
  variants: Array<SpecStreamEvent & { type: "variant" }>;
  funnel: Array<{ available_from: Record<string, string> }>;
  fullSpec: FullSpecData | null;
  anonymousSpecId: string | null;
  error: string | null;
};

export const initialSpecState: SpecState = {
  status: "idle",
  meta: null,
  cost: null,
  preflight: [],
  preflightOpinion: null,
  hypotheses: [],
  variants: [],
  funnel: [],
  fullSpec: null,
  anonymousSpecId: null,
  error: null,
};

export function specReducer(
  state: SpecState,
  event: SpecStreamEvent
): SpecState {
  switch (event.type) {
    case "meta":
      return { ...state, meta: event };
    case "cost":
      return { ...state, cost: event };
    case "preflight":
      return { ...state, preflight: [...state.preflight, event] };
    case "preflight_opinion":
      return { ...state, preflightOpinion: event.text };
    case "hypothesis":
      return { ...state, hypotheses: [...state.hypotheses, event] };
    case "variant":
      return { ...state, variants: [...state.variants, event] };
    case "funnel":
      return { ...state, funnel: [...state.funnel, event] };
    case "complete":
      return {
        ...state,
        status: "complete",
        fullSpec: event.spec,
        anonymousSpecId: event.anonymous_spec_id,
      };
    case "input_too_vague":
      return { ...state, status: "too_vague" };
    case "error":
      return { ...state, status: "error", error: event.message };
    default:
      return state;
  }
}
