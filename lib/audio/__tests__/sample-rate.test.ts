import { describe, it, expect } from "vitest";
import {
  DEEPGRAM_WIRE_INPUT_SAMPLE_RATE,
  DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE,
  resampleMonoFloat32ToWireRateInt16,
} from "../sample-rate";

describe("DEEPGRAM_WIRE_*_SAMPLE_RATE constants", () => {
  it("declares the Deepgram wire input rate as 16kHz", () => {
    expect(DEEPGRAM_WIRE_INPUT_SAMPLE_RATE).toBe(16000);
  });

  it("declares the Deepgram wire output rate as 24kHz", () => {
    expect(DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE).toBe(24000);
  });
});

describe("resampleMonoFloat32ToWireRateInt16", () => {
  it("keeps length unchanged when rates match", () => {
    const input = new Float32Array(1000);
    const result = resampleMonoFloat32ToWireRateInt16(input, 24000, 24000);
    expect(result).toHaveLength(1000);
  });

  it("downsamples 48kHz → 16kHz to 1/3 the length", () => {
    const input = new Float32Array(3000);
    const result = resampleMonoFloat32ToWireRateInt16(input, 48000, 16000);
    expect(result).toHaveLength(1000);
  });

  it("upsamples 16kHz → 48kHz to 3x the length", () => {
    const input = new Float32Array(1000);
    const result = resampleMonoFloat32ToWireRateInt16(input, 16000, 48000);
    expect(result).toHaveLength(3000);
  });

  it("clamps to int16 range at the float extremes", () => {
    const input = new Float32Array([1.0, -1.0, 2.0, -2.0]);
    const result = resampleMonoFloat32ToWireRateInt16(input, 16000, 16000);
    expect(Array.from(result)).toEqual([32767, -32768, 32767, -32768]);
  });

  it("quantizes 0.5 to 16383 and -0.5 to -16384 (asymmetric int16 range)", () => {
    const input = new Float32Array([0.5, -0.5]);
    const result = resampleMonoFloat32ToWireRateInt16(input, 16000, 16000);
    expect(Array.from(result)).toEqual([16383, -16384]);
  });

  it("preserves signal magnitude across resample (linear ramp)", () => {
    const length = 1000;
    const input = new Float32Array(length);
    for (let i = 0; i < length; i++) input[i] = (i - 500) / 500;
    const result = resampleMonoFloat32ToWireRateInt16(input, 16000, 16000);
    // Endpoint at -1.0 → -32768 (asymmetric int16 range, same as test above).
    expect(result[0]).toBe(-32768);
    expect(result[result.length - 1]).toBe(Math.round(0.998 * 32767));
  });

  it("returns a fresh standalone ArrayBuffer (no aliasing into the source Float32Array)", () => {
    const input = new Float32Array([0.25, 0.5, 0.75, 1.0]);
    const result = resampleMonoFloat32ToWireRateInt16(input, 16000, 16000);
    const sourceBuffer = input.buffer;
    expect(result.buffer).not.toBe(sourceBuffer);
    // Mutating the source must not mutate the result.
    input[0] = -1;
    expect(result[0]).toBeGreaterThan(0);
  });
});
