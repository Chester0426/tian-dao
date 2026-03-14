import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { NextResponse } from "next/server";

const dummyContext = { params: Promise.resolve({}) };

describe("withErrorHandler", () => {
  it("passes through successful handler response", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 200 })
    );
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("converts ZodError to validation_error (400)", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const handler = vi.fn().mockImplementation(async () => {
      schema.parse({});
      return NextResponse.json({});
    });
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(body.error.message).toBe("Invalid request");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("converts ApiError to correct status and code", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new ApiError("not_found", "Experiment not found");
    });
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Experiment not found");
  });

  it("includes details on ApiError when provided", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw new ApiError("ai_error", "Model timeout", { model: "claude" });
    });
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.details).toEqual({ model: "claude" });
  });

  it("converts unknown errors to internal_error (500)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue(new Error("DB crash"));
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(new Request("http://localhost"), dummyContext);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Internal server error");
    consoleSpy.mockRestore();
  });
});

describe("ApiError", () => {
  it("maps error codes to correct HTTP status", () => {
    expect(new ApiError("validation_error", "").status).toBe(400);
    expect(new ApiError("unauthorized", "").status).toBe(401);
    expect(new ApiError("not_found", "").status).toBe(404);
    expect(new ApiError("rate_limited", "").status).toBe(429);
    expect(new ApiError("ai_error", "").status).toBe(502);
    expect(new ApiError("internal_error", "").status).toBe(500);
  });
});
