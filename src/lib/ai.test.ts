import { describe, it, expect } from "vitest";
import { getText } from "./ai";
import type Anthropic from "@anthropic-ai/sdk";

describe("getText", () => {
  it("extracts text from a single text block", () => {
    const message = {
      content: [{ type: "text", text: "hello world" }],
    } as Anthropic.Message;
    expect(getText(message)).toBe("hello world");
  });

  it("joins multiple text blocks", () => {
    const message = {
      content: [
        { type: "text", text: "foo" },
        { type: "text", text: "bar" },
      ],
    } as Anthropic.Message;
    expect(getText(message)).toBe("foobar");
  });

  it("filters out non-text blocks", () => {
    const message = {
      content: [
        { type: "tool_use", id: "tu_1", name: "search", input: {} },
        { type: "text", text: "result" },
      ],
    } as Anthropic.Message;
    expect(getText(message)).toBe("result");
  });

  it("returns empty string when no text blocks", () => {
    const message = {
      content: [],
    } as unknown as Anthropic.Message;
    expect(getText(message)).toBe("");
  });
});
