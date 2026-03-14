import { describe, it, expect } from "vitest";
import {
  createExperimentSchema,
  updateExperimentSchema,
  listExperimentsSchema,
  createHypothesesSchema,
  hypothesesModeSchema,
  createVariantsSchema,
  variantsModeSchema,
  createInsightSchema,
  createResearchSchema,
  createRoundSchema,
} from "@/lib/experiment-schemas";

describe("createExperimentSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = createExperimentSchema.parse({
      name: "My Experiment",
      idea_text: "Validate this idea",
    });
    expect(result.name).toBe("My Experiment");
    expect(result.idea_text).toBe("Validate this idea");
    expect(result.experiment_type).toBe("web-app");
  });

  it("rejects name longer than 200 chars", () => {
    expect(() =>
      createExperimentSchema.parse({
        name: "a".repeat(201),
        idea_text: "valid",
      })
    ).toThrow();
  });

  it("rejects idea_text longer than 10000 chars", () => {
    expect(() =>
      createExperimentSchema.parse({
        name: "valid",
        idea_text: "a".repeat(10001),
      })
    ).toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      createExperimentSchema.parse({ name: "", idea_text: "valid" })
    ).toThrow();
  });

  it("rejects invalid experiment_type", () => {
    expect(() =>
      createExperimentSchema.parse({
        name: "valid",
        idea_text: "valid",
        experiment_type: "invalid",
      })
    ).toThrow();
  });

  it("accepts explicit experiment_type", () => {
    const result = createExperimentSchema.parse({
      name: "CLI Tool",
      idea_text: "A CLI experiment",
      experiment_type: "cli",
    });
    expect(result.experiment_type).toBe("cli");
  });
});

describe("updateExperimentSchema", () => {
  it("accepts partial updates", () => {
    const result = updateExperimentSchema.parse({ name: "Updated" });
    expect(result.name).toBe("Updated");
    expect(result.status).toBeUndefined();
  });

  it("accepts all fields", () => {
    const result = updateExperimentSchema.parse({
      name: "Updated",
      status: "active",
      deployed_url: "https://example.com",
      decision: "scale",
      decision_reasoning: "Good metrics",
      budget: 100,
    });
    expect(result.decision).toBe("scale");
    expect(result.budget).toBe(100);
  });

  it("rejects deployed_url longer than 500 chars", () => {
    expect(() =>
      updateExperimentSchema.parse({ deployed_url: "a".repeat(501) })
    ).toThrow();
  });

  it("rejects decision_reasoning longer than 5000 chars", () => {
    expect(() =>
      updateExperimentSchema.parse({
        decision_reasoning: "a".repeat(5001),
      })
    ).toThrow();
  });

  it("rejects invalid decision value", () => {
    expect(() =>
      updateExperimentSchema.parse({ decision: "invalid" })
    ).toThrow();
  });

  it("rejects negative budget", () => {
    expect(() =>
      updateExperimentSchema.parse({ budget: -1 })
    ).toThrow();
  });
});

describe("listExperimentsSchema", () => {
  it("provides defaults for page and limit", () => {
    const result = listExperimentsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string values to numbers", () => {
    const result = listExperimentsSchema.parse({ page: "3", limit: "50" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("rejects limit above 100", () => {
    expect(() =>
      listExperimentsSchema.parse({ limit: "101" })
    ).toThrow();
  });

  it("rejects page below 1", () => {
    expect(() => listExperimentsSchema.parse({ page: "0" })).toThrow();
  });
});

describe("createHypothesesSchema", () => {
  it("accepts valid array of hypotheses", () => {
    const result = createHypothesesSchema.parse([
      {
        hypothesis_key: "h-01",
        category: "demand",
        statement: "Users want this",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].hypothesis_key).toBe("h-01");
  });

  it("rejects empty array", () => {
    expect(() => createHypothesesSchema.parse([])).toThrow();
  });

  it("rejects hypothesis_key longer than 50 chars", () => {
    expect(() =>
      createHypothesesSchema.parse([
        {
          hypothesis_key: "a".repeat(51),
          category: "demand",
          statement: "valid",
        },
      ])
    ).toThrow();
  });

  it("rejects statement longer than 1000 chars", () => {
    expect(() =>
      createHypothesesSchema.parse([
        {
          hypothesis_key: "h-01",
          category: "demand",
          statement: "a".repeat(1001),
        },
      ])
    ).toThrow();
  });

  it("rejects invalid category", () => {
    expect(() =>
      createHypothesesSchema.parse([
        {
          hypothesis_key: "h-01",
          category: "invalid",
          statement: "valid",
        },
      ])
    ).toThrow();
  });

  it("rejects priority_score outside 0-100", () => {
    expect(() =>
      createHypothesesSchema.parse([
        {
          hypothesis_key: "h-01",
          category: "demand",
          statement: "valid",
          priority_score: 101,
        },
      ])
    ).toThrow();
  });

  it("accepts optional fields", () => {
    const result = createHypothesesSchema.parse([
      {
        hypothesis_key: "h-01",
        category: "reach",
        statement: "CTR > 2%",
        metric_formula: "clicks / impressions",
        metric_threshold: 0.02,
        metric_operator: "gte",
        priority_score: 90,
      },
    ]);
    expect(result[0].metric_operator).toBe("gte");
    expect(result[0].priority_score).toBe(90);
  });
});

describe("hypothesesModeSchema", () => {
  it("defaults to append", () => {
    expect(hypothesesModeSchema.parse(undefined)).toBe("append");
  });

  it("accepts replace", () => {
    expect(hypothesesModeSchema.parse("replace")).toBe("replace");
  });

  it("rejects invalid mode", () => {
    expect(() => hypothesesModeSchema.parse("invalid")).toThrow();
  });
});

describe("createVariantsSchema", () => {
  it("accepts valid variant array", () => {
    const result = createVariantsSchema.parse([
      { slug: "v1", headline: "Test", cta: "Click" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("v1");
  });

  it("rejects empty array", () => {
    expect(() => createVariantsSchema.parse([])).toThrow();
  });

  it("rejects slug longer than 50 chars", () => {
    expect(() =>
      createVariantsSchema.parse([
        { slug: "a".repeat(51), headline: "Test", cta: "Click" },
      ])
    ).toThrow();
  });

  it("rejects headline longer than 200 chars", () => {
    expect(() =>
      createVariantsSchema.parse([
        { slug: "v1", headline: "a".repeat(201), cta: "Click" },
      ])
    ).toThrow();
  });

  it("rejects cta longer than 100 chars", () => {
    expect(() =>
      createVariantsSchema.parse([
        { slug: "v1", headline: "Test", cta: "a".repeat(101) },
      ])
    ).toThrow();
  });

  it("accepts optional fields", () => {
    const result = createVariantsSchema.parse([
      {
        slug: "v1",
        headline: "Test",
        cta: "Click",
        subheadline: "Sub",
        pain_points: "Pain",
        promise: "Promise",
        proof: "Proof",
        urgency: "Urgency",
      },
    ]);
    expect(result[0].subheadline).toBe("Sub");
  });
});

describe("variantsModeSchema", () => {
  it("defaults to append", () => {
    expect(variantsModeSchema.parse(undefined)).toBe("append");
  });

  it("accepts replace", () => {
    expect(variantsModeSchema.parse("replace")).toBe("replace");
  });
});

describe("createInsightSchema", () => {
  it("accepts valid insight", () => {
    const result = createInsightSchema.parse({ decision: "scale" });
    expect(result.decision).toBe("scale");
  });

  it("rejects invalid decision", () => {
    expect(() =>
      createInsightSchema.parse({ decision: "invalid" })
    ).toThrow();
  });

  it("rejects reasoning longer than 5000 chars", () => {
    expect(() =>
      createInsightSchema.parse({
        decision: "kill",
        reasoning: "a".repeat(5001),
      })
    ).toThrow();
  });

  it("rejects next_steps longer than 2000 chars", () => {
    expect(() =>
      createInsightSchema.parse({
        decision: "refine",
        next_steps: "a".repeat(2001),
      })
    ).toThrow();
  });
});

describe("createResearchSchema", () => {
  it("accepts valid research", () => {
    const result = createResearchSchema.parse({
      query: "Is this market viable?",
      summary: "Yes, based on data",
      confidence: "high",
      verdict: "confirmed",
    });
    expect(result.query).toBe("Is this market viable?");
    expect(result.verdict).toBe("confirmed");
  });

  it("rejects query longer than 1000 chars", () => {
    expect(() =>
      createResearchSchema.parse({
        query: "a".repeat(1001),
        summary: "valid",
        confidence: "medium",
        verdict: "inconclusive",
      })
    ).toThrow();
  });

  it("rejects summary longer than 5000 chars", () => {
    expect(() =>
      createResearchSchema.parse({
        query: "valid",
        summary: "a".repeat(5001),
        confidence: "medium",
        verdict: "inconclusive",
      })
    ).toThrow();
  });

  it("rejects invalid confidence", () => {
    expect(() =>
      createResearchSchema.parse({
        query: "valid",
        summary: "valid",
        confidence: "invalid",
        verdict: "confirmed",
      })
    ).toThrow();
  });

  it("rejects invalid verdict", () => {
    expect(() =>
      createResearchSchema.parse({
        query: "valid",
        summary: "valid",
        confidence: "high",
        verdict: "invalid",
      })
    ).toThrow();
  });

  it("validates hypothesis_id as UUID", () => {
    expect(() =>
      createResearchSchema.parse({
        query: "valid",
        summary: "valid",
        confidence: "high",
        verdict: "confirmed",
        hypothesis_id: "not-a-uuid",
      })
    ).toThrow();
  });

  it("accepts valid hypothesis_id", () => {
    const result = createResearchSchema.parse({
      query: "valid",
      summary: "valid",
      confidence: "high",
      verdict: "confirmed",
      hypothesis_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.hypothesis_id).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });
});

describe("createRoundSchema", () => {
  it("accepts valid spec_snapshot object", () => {
    const result = createRoundSchema.parse({
      spec_snapshot: { name: "test", behaviors: [] },
    });
    expect(result.spec_snapshot).toEqual({ name: "test", behaviors: [] });
  });

  it("rejects non-object spec_snapshot", () => {
    expect(() =>
      createRoundSchema.parse({ spec_snapshot: "not an object" })
    ).toThrow();
  });

  it("rejects missing spec_snapshot", () => {
    expect(() => createRoundSchema.parse({})).toThrow();
  });
});
