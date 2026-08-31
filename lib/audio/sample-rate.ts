"use client";

/**
 * Wire-level sample rates used by the Deepgram voice agent (audio hooks here
 * only — the agent protocol rates live in useDeepgramAgent.ts and stay in sync
 * because they must match the Settings payload exactly).
 */

const DEEPGRAM_WIRE_INPUT_SAMPLE_RATE = 16000;
const DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE = 24000;

interface AudioContextLike {
  currentTime: number;
  sampleRate: number;
  createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => unknown;
}

interface AudioBufferLike {
  duration: number;
}

interface AudioBufferSourceNodeLike {
  start: (when: number) => void;
}

/**
 * One-shot fused: clamp → downsample → int16 → standalone buffer in a single
 * pass over the input, no intermediate Int16Array allocations. Used on the
 * hot path of useMicrophone's onaudioprocess callback (runs on the main
 * thread; allocation pressure stalls the audio thread).
 */
export function resampleMonoFloat32ToWireRateInt16(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Int16Array {
  const inputLength = samples.length;
  const outputLength = Math.floor((inputLength * targetSampleRate) / sourceSampleRate);
  const result = new Int16Array(outputLength);
  const lastInputIndex = inputLength - 1;
  const denom = outputLength > 1 ? outputLength - 1 : 1;
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = (i * lastInputIndex) / denom;
    const lowerIndex = sourceIndex | 0;
    const upperIndex = lowerIndex + 1 > lastInputIndex ? lastInputIndex : lowerIndex + 1;
    const fraction = sourceIndex - lowerIndex;
    const l = samples[lowerIndex];
    const interpolated = lowerIndex === upperIndex ? l : l + (samples[upperIndex] - l) * fraction;
    const clamped = interpolated > 1 ? 1 : interpolated < -1 ? -1 : interpolated;
    result[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return result;
}

export { DEEPGRAM_WIRE_INPUT_SAMPLE_RATE, DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE };
export type { AudioBufferLike, AudioBufferSourceNodeLike, AudioContextLike };