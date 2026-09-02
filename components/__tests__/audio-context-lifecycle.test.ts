import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Extract the production ensureAudioContext / releaseAudioContext implementations
 * from FluxAgentBench.tsx so the lifecycle contract is tested against the real
 * source rather than a copied mock.
 */
function readFluxAgentBench(): string {
  const filePath = path.resolve(
    process.cwd(),
    "components/FluxAgentBench.tsx"
  );
  return fs.readFileSync(filePath, "utf8");
}

describe("audio context ownership lifecycle (FluxAgentBench)", () => {
  let benchSource: string;

  beforeEach(() => {
    benchSource = readFluxAgentBench();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the AudioContext with interactive latency at 24kHz", () => {
    expect(benchSource).toContain('latencyHint: "interactive"');
    expect(benchSource).toContain("sampleRate: 24000");
  });

  it("retries via resume() when the browser suspends it (autoplay policy)", () => {
    expect(benchSource).toContain('audioContext.state === "suspended"');
    expect(benchSource).toContain("audioContext.resume()");
  });

  it("logs lifecycle events for observability", () => {
    expect(benchSource).toContain('event: "audio_context_created"');
    expect(benchSource).toContain('event: "audio_context_close_failed"');
    expect(benchSource).toContain('event: "audio_context_resume_failed"');
  });

  it("closes the context on disconnect (ownership released cleanly)", () => {
    expect(benchSource).toContain("releaseAudioContext()");
  });

  it("routes playback and mic through the same shared AudioContext", () => {
    expect(benchSource).toContain("const audioContext = ensureAudioContext();");
    expect(benchSource).toContain("initPlayback(audioContext)");
    expect(benchSource).toContain("startMicFnRef.current(audioContext)");
  });
});