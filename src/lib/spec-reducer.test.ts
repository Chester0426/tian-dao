import { describe, it, expect } from "vitest";
import {
  specReducer,
  initialSpecState,
  type SpecStreamEvent,
  type SpecState,
} from "@/lib/spec-reducer";

describe("initialSpecState", () => {
  it("has all expected default values", () => {
    expect(initialSpecState).toEqual({
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
    });
  });
});

describe("specReducer", () => {
  it("handles meta event - sets meta field", () => {
    const event: SpecStreamEvent = {
      type: "meta",
      name: "My Experiment",
      level: 2,
      experiment_type: "web-app",
    };
    const result = specReducer(initialSpecState, event);
    expect(result.meta).toEqual({
      type: "meta",
      name: "My Experiment",
      level: 2,
      experiment_type: "web-app",
    });
  });

  it("handles cost event - sets cost field", () => {
    const event: SpecStreamEvent = {
      type: "cost",
      build_cost: 500,
      ad_budget: 200,
      estimated_days: 14,
    };
    const result = specReducer(initialSpecState, event);
    expect(result.cost).toEqual({
      type: "cost",
      build_cost: 500,
      ad_budget: 200,
      estimated_days: 14,
    });
  });

  it("handles preflight event - appends to preflight array", () => {
    const event1: SpecStreamEvent = {
      type: "preflight",
      dimension: "market",
      status: "pass",
      summary: "Market looks good",
      confidence: "high",
    };
    const event2: SpecStreamEvent = {
      type: "preflight",
      dimension: "problem",
      status: "caution",
      summary: "Problem needs validation",
      confidence: "medium",
    };
    const state1 = specReducer(initialSpecState, event1);
    const state2 = specReducer(state1, event2);
    expect(state2.preflight).toHaveLength(2);
    expect(state2.preflight[0].dimension).toBe("market");
    expect(state2.preflight[1].dimension).toBe("problem");
  });

  it("handles preflight_opinion event - sets preflightOpinion", () => {
    const event: SpecStreamEvent = {
      type: "preflight_opinion",
      text: "Overall the idea has potential",
    };
    const result = specReducer(initialSpecState, event);
    expect(result.preflightOpinion).toBe("Overall the idea has potential");
  });

  it("handles hypothesis event - appends to hypotheses array", () => {
    const event1: SpecStreamEvent = {
      type: "hypothesis",
      id: "h-01",
      category: "demand",
      statement: "Users want this",
      metric: { formula: "signups / visitors", threshold: 0.05, operator: "gte" },
      priority_score: 90,
      experiment_level: 1,
      depends_on: [],
    };
    const event2: SpecStreamEvent = {
      type: "hypothesis",
      id: "h-02",
      category: "reach",
      statement: "CTR > 2%",
      metric: { formula: "clicks / impressions", threshold: 0.02, operator: "gt" },
      priority_score: 80,
      experiment_level: 1,
      depends_on: ["h-01"],
    };
    const state1 = specReducer(initialSpecState, event1);
    const state2 = specReducer(state1, event2);
    expect(state2.hypotheses).toHaveLength(2);
    expect(state2.hypotheses[0].id).toBe("h-01");
    expect(state2.hypotheses[1].id).toBe("h-02");
  });

  it("handles variant event - appends to variants array", () => {
    const event1: SpecStreamEvent = {
      type: "variant",
      slug: "control",
      headline: "Build faster",
      subheadline: "Ship in days",
      cta: "Get started",
      pain_points: ["slow development"],
      promise: "10x faster",
      proof: "Used by 1000+ teams",
      urgency: "Limited beta",
    };
    const event2: SpecStreamEvent = {
      type: "variant",
      slug: "challenger",
      headline: "Stop wasting time",
      subheadline: "Automate everything",
      cta: "Try free",
      pain_points: ["manual processes"],
      promise: "Full automation",
      proof: "Backed by data",
      urgency: null,
    };
    const state1 = specReducer(initialSpecState, event1);
    const state2 = specReducer(state1, event2);
    expect(state2.variants).toHaveLength(2);
    expect(state2.variants[0].slug).toBe("control");
    expect(state2.variants[1].slug).toBe("challenger");
  });

  it("handles funnel event - appends to funnel array", () => {
    const event: SpecStreamEvent = {
      type: "funnel",
      available_from: { landing: "/", signup: "/signup" },
    };
    const result = specReducer(initialSpecState, event);
    expect(result.funnel).toHaveLength(1);
    expect(result.funnel[0].available_from).toEqual({
      landing: "/",
      signup: "/signup",
    });
  });

  it("handles complete event - sets status, fullSpec, anonymousSpecId", () => {
    const specData = { name: "Test", hypotheses: [] };
    const event: SpecStreamEvent = {
      type: "complete",
      spec: specData,
      anonymous_spec_id: "abc-123",
    };
    const result = specReducer(initialSpecState, event);
    expect(result.status).toBe("complete");
    expect(result.fullSpec).toEqual(specData);
    expect(result.anonymousSpecId).toBe("abc-123");
  });

  it("handles input_too_vague event - sets status to too_vague", () => {
    const event: SpecStreamEvent = { type: "input_too_vague" };
    const result = specReducer(initialSpecState, event);
    expect(result.status).toBe("too_vague");
  });

  it("handles error event - sets status and error message", () => {
    const event: SpecStreamEvent = {
      type: "error",
      message: "Stream connection lost",
    };
    const result = specReducer(initialSpecState, event);
    expect(result.status).toBe("error");
    expect(result.error).toBe("Stream connection lost");
  });

  it("returns state unchanged for unknown event type", () => {
    const unknownEvent = { type: "unknown_event" } as unknown as SpecStreamEvent;
    const result = specReducer(initialSpecState, unknownEvent);
    expect(result).toEqual(initialSpecState);
  });

  it("does not mutate the original state", () => {
    const event: SpecStreamEvent = {
      type: "preflight",
      dimension: "market",
      status: "pass",
      summary: "OK",
      confidence: "high",
    };
    const originalPreflight = initialSpecState.preflight;
    specReducer(initialSpecState, event);
    expect(initialSpecState.preflight).toBe(originalPreflight);
    expect(initialSpecState.preflight).toHaveLength(0);
  });
});
