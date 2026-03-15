import { describe, it, expect } from "vitest";
import { parseSpecStreamLine } from "@/lib/spec-stream-parser";

describe("parseSpecStreamLine", () => {
  it("returns null for a regular text line (no >>>EVENT: prefix)", () => {
    expect(parseSpecStreamLine("This is regular output text")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseSpecStreamLine("")).toBeNull();
  });

  it("parses a valid meta event", () => {
    const line = '>>>EVENT: {"type":"meta","name":"test","level":1,"experiment_type":"web-app"}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "meta",
      name: "test",
      level: 1,
      experiment_type: "web-app",
    });
  });

  it("parses a valid cost event", () => {
    const line = '>>>EVENT: {"type":"cost","build_cost":150,"ad_budget":200,"estimated_days":7}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "cost",
      build_cost: 150,
      ad_budget: 200,
      estimated_days: 7,
    });
  });

  it("parses a valid preflight event with all fields", () => {
    const line = '>>>EVENT: {"type":"preflight","dimension":"market","status":"pass","summary":"Strong market signal","confidence":"high"}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "preflight",
      dimension: "market",
      status: "pass",
      summary: "Strong market signal",
      confidence: "high",
    });
  });

  it("parses a valid hypothesis event with nested metric object", () => {
    const line = '>>>EVENT: {"type":"hypothesis","id":"h1","category":"value","statement":"Users will pay","metric":{"formula":"conversion_rate","threshold":0.05,"operator":"gte"},"priority_score":8,"experiment_level":1,"depends_on":[]}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "hypothesis",
      id: "h1",
      category: "value",
      statement: "Users will pay",
      metric: {
        formula: "conversion_rate",
        threshold: 0.05,
        operator: "gte",
      },
      priority_score: 8,
      experiment_level: 1,
      depends_on: [],
    });
  });

  it("parses a valid variant event with pain_points array and null urgency", () => {
    const line = '>>>EVENT: {"type":"variant","slug":"control","headline":"Try it now","subheadline":"The best tool","cta":"Sign Up","pain_points":["slow process","manual work"],"promise":"Save time","proof":"100 users","urgency":null}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "variant",
      slug: "control",
      headline: "Try it now",
      subheadline: "The best tool",
      cta: "Sign Up",
      pain_points: ["slow process", "manual work"],
      promise: "Save time",
      proof: "100 users",
      urgency: null,
    });
  });

  it("parses a valid complete event with spec object", () => {
    const line = '>>>EVENT: {"type":"complete","spec":{"name":"test","version":1},"anonymous_spec_id":"abc-123"}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "complete",
      spec: { name: "test", version: 1 },
      anonymous_spec_id: "abc-123",
    });
  });

  it("returns null for malformed JSON", () => {
    const line = ">>>EVENT: {not valid json}";
    expect(parseSpecStreamLine(line)).toBeNull();
  });

  it("returns null for >>>EVENT: with no JSON after it", () => {
    expect(parseSpecStreamLine(">>>EVENT:")).toBeNull();
    expect(parseSpecStreamLine(">>>EVENT: ")).toBeNull();
  });

  it("handles >>>EVENT: with extra whitespace before the JSON", () => {
    const line = '>>>EVENT:   {"type":"meta","name":"test","level":1,"experiment_type":"web-app"}';
    const result = parseSpecStreamLine(line);
    expect(result).toEqual({
      type: "meta",
      name: "test",
      level: 1,
      experiment_type: "web-app",
    });
  });

  it("returns null for a line that contains >>>EVENT: in the middle (not prefix)", () => {
    const line = 'Some text >>>EVENT: {"type":"meta"}';
    expect(parseSpecStreamLine(line)).toBeNull();
  });
});
