import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("dashjs", () => ({
  default: { MediaPlayer: () => ({ create: vi.fn() }) },
  MediaPlayer: () => ({ create: vi.fn() }),
}));

describe("preload-dashjs", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getDashjsModule returns same promise on repeated calls", async () => {
    const { getDashjsModule } = await import("../preload-dashjs");

    const firstCallPromise = getDashjsModule();
    const secondCallPromise = getDashjsModule();

    expect(firstCallPromise).toBe(secondCallPromise);
  });

  it("preloadDashjsModule eagerly starts import before getDashjsModule is called", async () => {
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});
    const { preloadDashjsModule, getDashjsModule } = await import(
      "../preload-dashjs"
    );

    preloadDashjsModule();

    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    const parsedLogEntry = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
    expect(parsedLogEntry.event).toBe("dashjs_preload_started");

    const dashjsModule = await getDashjsModule();
    expect(dashjsModule).toBeDefined();
    consoleInfoSpy.mockRestore();
  });

  it("preloadDashjsModule is idempotent — second call is a no-op", async () => {
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});
    const { preloadDashjsModule } = await import("../preload-dashjs");

    preloadDashjsModule();
    preloadDashjsModule();

    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    consoleInfoSpy.mockRestore();
  });

  it("getDashjsModule works without prior preload call", async () => {
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});
    const { getDashjsModule } = await import("../preload-dashjs");

    const dashjsModule = await getDashjsModule();

    expect(dashjsModule).toBeDefined();
    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    const parsedLogEntry = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
    expect(parsedLogEntry.event).toBe("dashjs_lazy_import_started");
    consoleInfoSpy.mockRestore();
  });
});
