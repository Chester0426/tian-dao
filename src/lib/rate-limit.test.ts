import { describe, it, expect, beforeEach } from "vitest";
import {
  rateLimit,
  checkRateLimit,
  checkAuthRateLimit,
  checkSpecRateLimit,
  checkGeneralRateLimit,
  _resetStore,
} from "@/lib/rate-limit";

beforeEach(() => {
  _resetStore();
});

describe("rateLimit", () => {
  it("allows requests within limit", () => {
    const r1 = rateLimit("test-key", 3);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit("test-key", 3);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit("test-key", 3);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over limit", () => {
    for (let i = 0; i < 3; i++) rateLimit("over", 3);
    const r4 = rateLimit("over", 3);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("uses separate counters per key", () => {
    rateLimit("a", 1);
    const rb = rateLimit("b", 1);
    expect(rb.allowed).toBe(true);
  });

  it("accepts custom window", () => {
    const r = rateLimit("custom", 5, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
});

describe("checkRateLimit", () => {
  it("returns null when allowed", () => {
    expect(checkRateLimit("ok", 5)).toBeNull();
  });

  it("returns 429 Response when exceeded", async () => {
    for (let i = 0; i < 5; i++) checkRateLimit("flood", 5);
    const res = checkRateLimit("flood", 5);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = await res!.json();
    expect(body.error.code).toBe("rate_limited");
    expect(res!.headers.get("Retry-After")).toBe("60");
  });
});

describe("preset functions", () => {
  it("checkAuthRateLimit allows 5 per minute", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkAuthRateLimit("1.2.3.4")).toBeNull();
    }
    expect(checkAuthRateLimit("1.2.3.4")).not.toBeNull();
  });

  it("checkSpecRateLimit allows 3 per 24h", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkSpecRateLimit("session-abc")).toBeNull();
    }
    expect(checkSpecRateLimit("session-abc")).not.toBeNull();
  });

  it("checkGeneralRateLimit allows 30 per minute", () => {
    for (let i = 0; i < 30; i++) {
      expect(checkGeneralRateLimit("5.6.7.8")).toBeNull();
    }
    expect(checkGeneralRateLimit("5.6.7.8")).not.toBeNull();
  });
});
