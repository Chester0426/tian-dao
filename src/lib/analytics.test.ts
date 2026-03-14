import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock posthog-js before importing analytics
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

describe("analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Simulate browser environment
    vi.stubGlobal("window", {});
  });

  it("attaches project_name to every tracked event", async () => {
    const posthog = (await import("posthog-js")).default;
    const { track } = await import("./analytics");

    track("test_event", { foo: "bar" });

    expect(posthog.capture).toHaveBeenCalledWith(
      "test_event",
      expect.objectContaining({ project_name: "assayer" })
    );
  });

  it("does not override caller properties with project_name", async () => {
    const posthog = (await import("posthog-js")).default;
    const { track } = await import("./analytics");

    track("test_event", { custom: "value" });

    const call = (posthog.capture as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toMatchObject({ custom: "value", project_name: "assayer" });
  });

  it("skips init when window is undefined (server side)", async () => {
    vi.stubGlobal("window", undefined);
    const posthog = (await import("posthog-js")).default;
    const { track } = await import("./analytics");

    track("server_event");

    expect(posthog.init).not.toHaveBeenCalled();
  });
});
