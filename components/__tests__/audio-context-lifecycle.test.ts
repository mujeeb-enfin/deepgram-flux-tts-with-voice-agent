import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

function readFluxAgentBench(): string {
  const filePath = path.resolve(
    process.cwd(),
    "components/FluxAgentBench.tsx"
  );
  return fs.readFileSync(filePath, "utf8");
}

function readUseMicrophone(): string {
  const filePath = path.resolve(process.cwd(), "hooks/useMicrophone.ts");
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

  it("logs mic start failure instead of swallowing (no bare catch)", () => {
    expect(benchSource).toContain('event: "mic_start_failed"');
    expect(benchSource).not.toContain(".catch(() => {})");
  });
});

describe("AudioWorklet support in useMicrophone", () => {
  let micSource: string;

  beforeEach(() => {
    micSource = readUseMicrophone();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attempts AudioWorkletNode before ScriptProcessorNode", () => {
    const workletIndex = micSource.indexOf("audioWorklet.addModule");
    const scriptIndex = micSource.indexOf("createScriptProcessor");
    expect(workletIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeGreaterThan(-1);
    expect(workletIndex).toBeLessThan(scriptIndex);
  });

  it("loads mic-worklet-processor.js from the public dir", () => {
    expect(micSource).toContain(
      'addModule("/mic-worklet-processor.js")'
    );
  });

  it("falls back to ScriptProcessorNode on worklet failure", () => {
    expect(micSource).toContain("if (!workletLoaded)");
    expect(micSource).toContain("createScriptProcessor(4096, 1, 1)");
  });

  it("logs worklet success and fallback events", () => {
    expect(micSource).toContain('event: "audio_worklet_loaded"');
    expect(micSource).toContain('event: "audio_worklet_fallback"');
  });

  it("routes mute/suppress state to the worklet via MessagePort", () => {
    expect(micSource).toContain('type: "mute"');
    expect(micSource).toContain('type: "suppress"');
    expect(micSource).toContain("port.postMessage");
  });

  it("cleans up worklet node in stopMic", () => {
    expect(micSource).toContain("micWorkletNodeRef.current.disconnect()");
    expect(micSource).toContain("micWorkletNodeRef.current.port.close()");
  });
});
